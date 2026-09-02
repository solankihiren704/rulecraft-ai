import { prisma } from '@/config/prisma'
import type { CreateDepartmentInput, UpdateDepartmentInput } from './departments.validators'

export function list(search?: string) {
  return prisma.department.findMany({
    where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
    orderBy: { name: 'asc' },
  })
}

export function findById(id: string) {
  return prisma.department.findUnique({ where: { id } })
}

export function create(data: CreateDepartmentInput) {
  return prisma.department.create({ data })
}

export function update(id: string, data: UpdateDepartmentInput) {
  return prisma.department.update({ where: { id }, data })
}

export function remove(id: string) {
  return prisma.department.delete({ where: { id } })
}

export function countPrograms(departmentId: string) {
  return prisma.program.count({ where: { departmentId } })
}
