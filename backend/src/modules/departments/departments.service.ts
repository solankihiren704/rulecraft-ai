import { ApiError } from '@/middleware/errorHandler'
import * as repo from './departments.repository'
import { toDepartment } from './departments.mapper'
import type { CreateDepartmentInput, UpdateDepartmentInput } from './departments.validators'

export async function list(search?: string) {
  const rows = await repo.list(search)
  return rows.map(toDepartment)
}

export async function getById(id: string) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Department not found')
  return toDepartment(row)
}

export async function create(input: CreateDepartmentInput) {
  const row = await repo.create(input)
  return toDepartment(row)
}

export async function update(id: string, input: UpdateDepartmentInput) {
  await getById(id) // 404 if missing
  const row = await repo.update(id, input)
  return toDepartment(row)
}

export async function remove(id: string) {
  await getById(id) // 404 if missing
  const programCount = await repo.countPrograms(id)
  if (programCount > 0) {
    throw new ApiError(409, `Cannot delete a department with ${programCount} active program(s). Move or delete them first.`)
  }
  await repo.remove(id)
}
