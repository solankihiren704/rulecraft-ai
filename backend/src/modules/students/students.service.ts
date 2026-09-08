import { ApiError } from '@/middleware/errorHandler'
import { assertInScope } from '@/middleware/authorize'
import * as programsRepo from '@/modules/programs/programs.repository'
import { renderCsv, renderPdf, type ReportPayload } from '@/modules/reports/reports.render'
import type { Role } from '@/types'
import * as repo from './students.repository'
import { toStudent } from './students.mapper'
import { buildImportTemplate, type ProgramReference, type RawImportRow } from './students.import'
import { importStudentRowSchema } from './students.validators'
import type { CreateStudentInput, ExportStudentsInput, ImportTemplateQuery, ListStudentsQuery, UpdateStudentInput } from './students.validators'

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

async function assertProgramExists(programId: string) {
  const program = await programsRepo.findById(programId)
  if (!program) throw new ApiError(400, 'That program does not exist.', { programId: 'Invalid program.' })
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

export async function create(input: CreateStudentInput) {
  await assertProgramExists(input.programId)
  await assertEmailAvailable(input.email)
  await assertStudentIdAvailable(input.studentId)
  const row = await repo.create(input)
  return toStudent(row)
}

export async function update(id: string, input: UpdateStudentInput) {
  const current = await repo.findById(id)
  if (!current) throw new ApiError(404, 'Student not found')
  await assertProgramExists(input.programId)
  if (input.email.toLowerCase() !== current.email) await assertEmailAvailable(input.email, id)
  if (input.studentId !== current.studentId) await assertStudentIdAvailable(input.studentId, id)
  const row = await repo.update(id, input)
  return toStudent(row)
}

export async function remove(id: string) {
  const current = await repo.findById(id)
  if (!current) throw new ApiError(404, 'Student not found')
  await repo.remove(id)
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
  results: ImportRowResult[]
}

export async function importStudents(rawRows: RawImportRow[]): Promise<ImportSummary> {
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
      enrollDate: new Date(),
    })
    results.push({ row: item.row, status: 'created', name: data.name, email })
  }

  if (toCreate.length > 0) {
    await repo.createMany(toCreate)
  }

  return {
    totalRows: rawRows.length,
    createdCount: toCreate.length,
    failedCount: results.length - toCreate.length,
    results,
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
