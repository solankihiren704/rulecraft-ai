import { ApiError } from '@/middleware/errorHandler'
import { findById as findSemesterById } from '@/modules/semesters/semesters.repository'
import * as repo from './subjects.repository'
import { toSubject } from './subjects.mapper'
import type { CreateSubjectInput, UpdateSubjectInput } from './subjects.validators'

export async function list(filters: { semesterId?: string; search?: string }) {
  const rows = await repo.list(filters)
  return rows.map(toSubject)
}

export async function getById(id: string) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Subject not found')
  return toSubject(row)
}

async function assertSemesterExists(semesterId: string) {
  const semester = await findSemesterById(semesterId)
  if (!semester) throw new ApiError(400, 'That semester does not exist.', { semesterId: 'Invalid semester.' })
}

async function assertCodeAvailable(semesterId: string, code: string, excludeId?: string) {
  const existing = await repo.findBySemesterAndCode(semesterId, code)
  if (existing && existing.id !== excludeId) {
    throw new ApiError(409, `Subject code "${code}" is already used in this semester.`, { code: 'Already in use for this semester.' })
  }
}

export async function create(input: CreateSubjectInput) {
  await assertSemesterExists(input.semesterId)
  await assertCodeAvailable(input.semesterId, input.code)
  const row = await repo.create(input)
  return toSubject(row)
}

export async function update(id: string, input: UpdateSubjectInput) {
  await getById(id)
  await assertSemesterExists(input.semesterId)
  await assertCodeAvailable(input.semesterId, input.code, id)
  const row = await repo.update(id, input)
  return toSubject(row)
}

export async function remove(id: string) {
  await getById(id)
  await repo.remove(id)
}
