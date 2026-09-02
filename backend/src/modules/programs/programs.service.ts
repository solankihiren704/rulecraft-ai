import { ApiError } from '@/middleware/errorHandler'
import { findById as findDepartmentById } from '@/modules/departments/departments.repository'
import * as repo from './programs.repository'
import { toProgram } from './programs.mapper'
import type { CreateProgramInput, UpdateProgramInput } from './programs.validators'

export async function list(filters: { departmentId?: string; search?: string }) {
  const rows = await repo.list(filters)
  return rows.map(toProgram)
}

export async function getById(id: string) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Program not found')
  return toProgram(row)
}

async function assertDepartmentExists(departmentId: string) {
  const department = await findDepartmentById(departmentId)
  if (!department) throw new ApiError(400, 'That department does not exist.', { departmentId: 'Invalid department.' })
}

export async function create(input: CreateProgramInput) {
  await assertDepartmentExists(input.departmentId)
  const row = await repo.create(input)
  return toProgram(row)
}

export async function update(id: string, input: UpdateProgramInput) {
  await getById(id)
  await assertDepartmentExists(input.departmentId)
  const row = await repo.update(id, input)
  return toProgram(row)
}

export async function remove(id: string) {
  await getById(id)
  const [semesterCount, studentCount, regulationCount] = await repo.countChildren(id)
  const parts = [
    semesterCount > 0 ? `${semesterCount} semester(s)` : null,
    studentCount > 0 ? `${studentCount} student(s)` : null,
    regulationCount > 0 ? `${regulationCount} regulation(s)` : null,
  ].filter(Boolean)

  if (parts.length > 0) {
    throw new ApiError(409, `Cannot delete a program with ${parts.join(', ')} still attached.`)
  }
  await repo.remove(id)
}
