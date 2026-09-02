import { prisma } from '@/config/prisma'
import type { CreateProgramInput, UpdateProgramInput } from './programs.validators'

export function list(filters: { departmentId?: string; search?: string }) {
  return prisma.program.findMany({
    where: {
      departmentId: filters.departmentId,
      name: filters.search ? { contains: filters.search, mode: 'insensitive' } : undefined,
    },
    orderBy: { name: 'asc' },
  })
}

export function findById(id: string) {
  return prisma.program.findUnique({ where: { id } })
}

export function create(data: CreateProgramInput) {
  return prisma.program.create({ data })
}

export function update(id: string, data: UpdateProgramInput) {
  return prisma.program.update({ where: { id }, data })
}

export function remove(id: string) {
  return prisma.program.delete({ where: { id } })
}

export function countChildren(programId: string) {
  return Promise.all([
    prisma.semester.count({ where: { programId } }),
    prisma.student.count({ where: { programId } }),
    prisma.regulation.count({ where: { programId } }),
  ])
}
