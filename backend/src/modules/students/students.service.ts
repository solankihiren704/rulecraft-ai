import { ApiError } from '@/middleware/errorHandler'
import { assertInScope } from '@/middleware/authorize'
import { findById as findProgramById } from '@/modules/programs/programs.repository'
import type { Role } from '@/types'
import * as repo from './students.repository'
import { toStudent } from './students.mapper'
import type { CreateStudentInput, ListStudentsQuery, UpdateStudentInput } from './students.validators'

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
  const program = await findProgramById(programId)
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
