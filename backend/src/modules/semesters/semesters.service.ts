import { ApiError } from '@/middleware/errorHandler'
import { findById as findProgramById } from '@/modules/programs/programs.repository'
import * as repo from './semesters.repository'
import { toSemester } from './semesters.mapper'
import type { CreateSemesterInput, UpdateSemesterInput } from './semesters.validators'

export async function list(filters: { programId?: string; search?: string }) {
  const rows = await repo.list(filters)
  return rows.map(toSemester)
}

export async function getById(id: string) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Semester not found')
  return toSemester(row)
}

async function assertProgramExists(programId: string) {
  const program = await findProgramById(programId)
  if (!program) throw new ApiError(400, 'That program does not exist.', { programId: 'Invalid program.' })
}

export async function create(input: CreateSemesterInput) {
  await assertProgramExists(input.programId)
  const row = await repo.create(input)
  return toSemester(row)
}

export async function update(id: string, input: UpdateSemesterInput) {
  await getById(id)
  await assertProgramExists(input.programId)
  const row = await repo.update(id, input)
  return toSemester(row)
}

export async function remove(id: string) {
  await getById(id)
  const subjectCount = await repo.countSubjects(id)
  if (subjectCount > 0) {
    throw new ApiError(409, `Cannot delete a semester with ${subjectCount} subject(s) still attached.`)
  }
  await repo.remove(id)
}
