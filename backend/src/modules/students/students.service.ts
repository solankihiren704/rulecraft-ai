import { prisma } from '@/config/prisma'
import { hashPassword } from '@/utils/password'
import { ApiError } from '@/middleware/errorHandler'
import { assertInScope } from '@/middleware/authorize'
import * as programsRepo from '@/modules/programs/programs.repository'
import { renderCsv, renderPdf, type ReportPayload } from '@/modules/reports/reports.render'
import type { Role } from '@/types'
import * as repo from './students.repository'
import { toStudent } from './students.mapper'
import { buildCredentialsWorkbook, buildImportTemplate, type ProgramReference, type RawImportRow, type StudentCredentialRow } from './students.import'
import { autoProvisionAcademicStructure, type AutoProvisionSummary } from './students.provisioning'
import {
  importStudentRowSchema,
  type CreateStudentInput,
  type ExportStudentsInput,
  type ImportTemplateQuery,
  type ListStudentsQuery,
  type UpdateStudentInput,
} from './students.validators'
import { computeStudentResult, renderMarksheetPdf } from './students.result'

interface CurrentUser {
  id: string
  role: Role
  departmentId: string | null
}

type StudentWithProgram = Awaited<ReturnType<typeof repo.findById>>

/**
 * Row visibility mirrors the pattern already established in
 * simulator.service.ts: super_admin/registrar see everything, hod/faculty
 * are scoped to their own department (via the student's program), and a
 * student sees only their own linked record.
 */
function scopeFor(user: CurrentUser): { departmentId?: string; userId?: string } {
  if (user.role === 'hod' || user.role === 'faculty') {
    return { departmentId: user.departmentId ?? undefined }
  }
  if (user.role === 'student') {
    return { userId: user.id }
  }
  return {}
}

function assertVisible(user: CurrentUser, row: NonNullable<StudentWithProgram>) {
  if (user.role === 'super_admin' || user.role === 'registrar') return
  if (user.role === 'student') {
    if (row.userId !== user.id) throw new ApiError(403, 'You can only view your own student record.')
    return
  }
  assertInScope(user, row.program.departmentId)
}

export async function list(query: ListStudentsQuery, user: CurrentUser) {
  const rows = await repo.list({ ...query, ...scopeFor(user) })
  return rows.map(toStudent)
}

export async function getById(id: string, user: CurrentUser) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Student not found')
  assertVisible(user, row)
  return toStudent(row)
}

async function assertEmailAvailable(email: string, excludeId?: string) {
  const existing = await repo.findByEmail(email)
  if (existing && existing.id !== excludeId) {
    throw new ApiError(409, `Email "${email}" is already in use.`, { email: 'Already in use.' })
  }
}

async function assertStudentIdAvailable(studentId: string, excludeId?: string) {
  const existing = await repo.findByStudentId(studentId)
  if (existing && existing.id !== excludeId) {
    throw new ApiError(409, `Student ID "${studentId}" is already in use.`, { studentId: 'Already in use.' })
  }
}

export async function create(input: CreateStudentInput, user?: CurrentUser) {
  const program = await programsRepo.findById(input.programId)
  if (!program) throw new ApiError(400, 'That program does not exist.', { programId: 'Invalid program.' })

  if (user && user.role === 'hod') {
    if (program.departmentId !== user.departmentId) {
      throw new ApiError(403, 'HODs can only add students to programs within their department.')
    }
  }

  await assertEmailAvailable(input.email)
  await assertStudentIdAvailable(input.studentId)

  // Auto-provision a student user account if one doesn't exist
  let loginUser = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } })
  if (!loginUser) {
    const passwordHash = await hashPassword('Demo@1234')
    const initials = input.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
    loginUser = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        role: 'student',
        departmentId: program.departmentId,
        avatarInitials: initials,
      },
    })
  }

  const row = await repo.create({
    ...input,
    userId: loginUser.id,
  })
  return toStudent(row)
}

export async function update(id: string, input: UpdateStudentInput, user?: CurrentUser) {
  const current = await repo.findById(id)
  if (!current) throw new ApiError(404, 'Student not found')

  if (user && user.role === 'hod') {
    if (current.program.departmentId !== user.departmentId) {
      throw new ApiError(403, 'HODs can only manage students within their department.')
    }
  }

  const program = await programsRepo.findById(input.programId)
  if (!program) throw new ApiError(400, 'That program does not exist.', { programId: 'Invalid program.' })

  if (user && user.role === 'hod') {
    if (program.departmentId !== user.departmentId) {
      throw new ApiError(403, 'HODs can only assign students to programs within their department.')
    }
  }

  if (input.email.toLowerCase() !== current.email) await assertEmailAvailable(input.email, id)
  if (input.studentId !== current.studentId) await assertStudentIdAvailable(input.studentId, id)

  // Also sync User name/email if linked
  if (current.userId) {
    await prisma.user.update({
      where: { id: current.userId },
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
      },
    }).catch(() => null)
  }

  const row = await repo.update(id, input)
  return toStudent(row)
}

export async function remove(id: string, user?: CurrentUser) {
  const current = await repo.findById(id)
  if (!current) throw new ApiError(404, 'Student not found')

  if (user && user.role === 'hod') {
    if (current.program.departmentId !== user.departmentId) {
      throw new ApiError(403, 'HODs can only remove students within their department.')
    }
  }

  await repo.remove(id)
  // If student had a login User account, delete it as well
  if (current.userId) {
    await prisma.user.delete({ where: { id: current.userId } }).catch(() => null)
  }
}

// --- Bulk import ------------------------------------------------------
//
// Two-phase design: fully validate and resolve every row against the
// database first (bulk-fetching program codes and existing emails/IDs in a
// couple of queries, not one per row), THEN insert only the rows that
// passed everything in a single createMany. This keeps the report of
// what-succeeded/what-failed accurate without leaving a partially-applied
// batch if something downstream goes wrong.

const MAX_IMPORT_ROWS = 2000

export interface ImportRowResult {
  row: number
  status: 'created' | 'failed'
  name?: string
  email?: string
  error?: string
}

export interface ImportSummary {
  totalRows: number
  createdCount: number
  failedCount: number
  autoProvisioned?: AutoProvisionSummary
  results: ImportRowResult[]
  createdStudentIds?: string[]
}

export async function importStudents(
  rawRows: RawImportRow[],
  options: { autoProvision?: boolean } = { autoProvision: true },
): Promise<ImportSummary> {
  if (rawRows.length === 0) {
    throw new ApiError(400, 'The file has no student rows to import. Use the template and fill at least one row.')
  }
  if (rawRows.length > MAX_IMPORT_ROWS) {
    throw new ApiError(400, `A single import is limited to ${MAX_IMPORT_ROWS} rows — split large rosters into multiple files.`)
  }

  const parsed = rawRows.map(({ row, values }) => {
    const result = importStudentRowSchema.safeParse(values)
    return result.success
      ? { row, data: result.data }
      : { row, name: values.name, email: values.email, error: result.error.issues[0]?.message ?? 'This row could not be read.' }
  })

  const validRows = parsed.filter((r): r is { row: number; data: NonNullable<typeof r.data> } => 'data' in r && !!r.data)

  const codes = [...new Set(validRows.map((r) => r.data.programCode))]
  const programs = codes.length ? await programsRepo.findManyByCodes(codes) : []
  const programByCode = new Map(programs.map((p) => [p.code, p]))

  const unresolvedCodes = codes.filter((c) => !programByCode.has(c))
  let autoProvisionSummary: AutoProvisionSummary | undefined

  if (unresolvedCodes.length > 0 && options.autoProvision !== false) {
    const { createdPrograms, summary } = await autoProvisionAcademicStructure(unresolvedCodes, validRows)
    for (const [code, prog] of createdPrograms) {
      programByCode.set(code, prog as never)
    }
    if (summary.departments.length > 0 || summary.programs.length > 0) {
      autoProvisionSummary = summary
    }
  }

  const emails = [...new Set(validRows.map((r) => r.data.email.toLowerCase()))]
  const studentIds = [...new Set(validRows.map((r) => r.data.studentId))]
  const existing = emails.length || studentIds.length ? await repo.findExisting(emails, studentIds) : []
  const existingEmails = new Set(existing.map((e) => e.email))
  const existingStudentIds = new Set(existing.map((e) => e.studentId))

  const seenEmails = new Set<string>()
  const seenStudentIds = new Set<string>()
  const results: ImportRowResult[] = []
  const toCreate: repo.ImportRow[] = []

  for (const item of parsed) {
    if (!('data' in item) || !item.data) {
      results.push({ row: item.row, status: 'failed', name: item.name, email: item.email, error: item.error })
      continue
    }
    const data = item.data
    const email = data.email.toLowerCase()
    const program = programByCode.get(data.programCode)

    if (!program) {
      results.push({ row: item.row, status: 'failed', name: data.name, email, error: `Unknown program code "${data.programCode}".` })
      continue
    }
    if (existingEmails.has(email) || seenEmails.has(email)) {
      results.push({ row: item.row, status: 'failed', name: data.name, email, error: `Email "${email}" is already in use.` })
      continue
    }
    if (existingStudentIds.has(data.studentId) || seenStudentIds.has(data.studentId)) {
      results.push({ row: item.row, status: 'failed', name: data.name, email, error: `Student ID "${data.studentId}" is already in use.` })
      continue
    }

    seenEmails.add(email)
    seenStudentIds.add(data.studentId)
    toCreate.push({
      name: data.name,
      email,
      studentId: data.studentId,
      programId: program.id,
      year: data.year,
      status: data.status,
      gpa: data.gpa,
      attendance: data.attendance ?? 85,
      enrollDate: new Date(),
    })
    results.push({ row: item.row, status: 'created', name: data.name, email })
  }

  if (toCreate.length > 0) {
    const defaultPasswordHash = await hashPassword('Demo@1234')
    for (const s of toCreate) {
      let existingUser = await prisma.user.findUnique({ where: { email: s.email } })
      if (!existingUser) {
        const initials = s.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
        const prog = Array.from(programByCode.values()).find((p) => p.id === s.programId)
        existingUser = await prisma.user.create({
          data: {
            name: s.name,
            email: s.email,
            passwordHash: defaultPasswordHash,
            role: 'student',
            departmentId: prog?.departmentId ?? null,
            avatarInitials: initials,
          },
        })
      }
      s.userId = existingUser.id
    }
    await repo.createMany(toCreate)
  }

  return {
    totalRows: rawRows.length,
    createdCount: toCreate.length,
    failedCount: results.length - toCreate.length,
    autoProvisioned: autoProvisionSummary,
    results,
    createdStudentIds: toCreate.map((s) => s.studentId),
  }
}

export async function buildTemplate(filters: ImportTemplateQuery): Promise<Buffer> {
  const effectiveDepartmentId = filters.programId ? undefined : filters.departmentId
  const all = await programsRepo.listWithDepartmentName({ departmentId: effectiveDepartmentId })
  const scoped = filters.programId ? all.filter((p) => p.id === filters.programId) : all
  const references: ProgramReference[] = scoped.map((p) => ({ code: p.code, name: p.name, departmentName: p.department.name }))
  return buildImportTemplate(references)
}

// --- Bulk export ---------------------------------------------------------

interface ExportUser extends CurrentUser {
  name: string
}

const FORMAT_CONTENT_TYPE = { csv: 'text/csv', pdf: 'application/pdf' } as const

export async function exportSelected(input: ExportStudentsInput, user: ExportUser) {
  const rows = await repo.findManyByIds(input.studentIds)

  // Row-level visibility mirrors getById — silently drop rows the caller
  // can't see (a stale selection, e.g. from before a filter changed)
  // rather than erroring the whole export over one out-of-scope row.
  const visible = rows.filter((row) => {
    try {
      assertVisible(user, row)
      return true
    } catch {
      return false
    }
  })

  const payload: ReportPayload = {
    title: 'Student Export',
    subtitle: `${visible.length} student${visible.length === 1 ? '' : 's'}`,
    generatedAt: new Date(),
    generatedBy: user.name,
    notes:
      rows.length !== visible.length
        ? [`${rows.length - visible.length} of the selected student(s) were excluded — outside your visibility.`]
        : [],
    summary: [{ label: 'Students exported', value: visible.length }],
    tableTitle: 'Students',
    tableColumns: ['Name', 'Email', 'Student ID', 'Department', 'Program', 'Year', 'Status', 'GPA'],
    tableRows: visible.map((s) => [
      s.name,
      s.email,
      s.studentId,
      s.program.department.name,
      s.program.name,
      s.year,
      s.status,
      s.gpa.toFixed(2),
    ]),
  }

  const buffer = input.format === 'csv' ? renderCsv(payload) : await renderPdf(payload)
  const datestamp = new Date().toISOString().slice(0, 10)

  return {
    buffer,
    filename: `students-export-${datestamp}.${input.format}`,
    contentType: FORMAT_CONTENT_TYPE[input.format],
  }
}

export async function getResult(id: string, user: CurrentUser) {
  const row = await repo.findResultStudentById(id)
  if (!row) throw new ApiError(404, 'Student not found')
  assertVisible(user, row)
  return await computeStudentResult(row)
}

export async function buildResultPdf(id: string, user: CurrentUser) {
  const result = await getResult(id, user)
  const buffer = await renderMarksheetPdf(result)
  return {
    buffer,
    filename: `marksheet-${result.student.studentId}.pdf`,
    contentType: 'application/pdf',
  }
}

export async function buildCredentialsFile(
  filters: { departmentId?: string; programId?: string; studentIds?: string[] },
  caller?: CurrentUser,
): Promise<{ buffer: Buffer; filename: string }> {
  let effectiveDepartmentId = filters.departmentId
  if (caller?.role === 'hod' && caller.departmentId) {
    effectiveDepartmentId = caller.departmentId
  }

  const students = await prisma.student.findMany({
    where: {
      ...(filters.studentIds && filters.studentIds.length > 0 ? { studentId: { in: filters.studentIds } } : {}),
      ...(filters.programId ? { programId: filters.programId } : {}),
      ...(effectiveDepartmentId ? { program: { departmentId: effectiveDepartmentId } } : {}),
    },
    include: {
      program: {
        include: { department: true },
      },
    },
    orderBy: [{ program: { name: 'asc' } }, { year: 'asc' }, { studentId: 'asc' }],
  })

  const rows: StudentCredentialRow[] = students.map((s) => ({
    studentId: s.studentId,
    name: s.name,
    email: s.email,
    departmentName: s.program?.department?.name,
    programName: s.program?.name,
    year: s.year,
    tempPassword: 'Demo@1234',
  }))

  const buffer = await buildCredentialsWorkbook(rows)
  const datestamp = new Date().toISOString().slice(0, 10)
  return {
    buffer,
    filename: `student-credentials-whatsapp-${datestamp}.xlsx`,
  }
}

export async function resetPassword(
  studentId: string,
  caller: CurrentUser,
): Promise<{ message: string; tempPassword: string }> {
  const student = await repo.findById(studentId)
  if (!student) throw new ApiError(404, 'Student not found')
  assertVisible(caller, student)

  const tempPassword = 'Demo@1234'
  const passwordHash = await hashPassword(tempPassword)

  if (student.userId) {
    await prisma.user.update({
      where: { id: student.userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    })
  } else {
    const initials = student.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
    const prog = await prisma.program.findUnique({ where: { id: student.programId } })
    const user = await prisma.user.create({
      data: {
        name: student.name,
        email: student.email,
        passwordHash,
        role: 'student',
        departmentId: prog?.departmentId ?? null,
        avatarInitials: initials,
      },
    })
    await prisma.student.update({
      where: { id: student.id },
      data: { userId: user.id },
    })
  }

  return { message: `Password for ${student.name} (${student.studentId}) was reset to Demo@1234.`, tempPassword }
}

