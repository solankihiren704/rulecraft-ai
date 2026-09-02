import { prisma } from '@/config/prisma'
import type { CreateSubjectInput, UpdateSubjectInput } from './subjects.validators'

export function list(filters: { semesterId?: string; search?: string }) {
  return prisma.subject.findMany({
    where: {
      semesterId: filters.semesterId,
      name: filters.search ? { contains: filters.search, mode: 'insensitive' } : undefined,
    },
    orderBy: { code: 'asc' },
  })
}

export function findById(id: string) {
  return prisma.subject.findUnique({ where: { id } })
}

export function findBySemesterAndCode(semesterId: string, code: string) {
  return prisma.subject.findUnique({ where: { semesterId_code: { semesterId, code } } })
}

export function create(data: CreateSubjectInput) {
  return prisma.subject.create({ data })
}

export function update(id: string, data: UpdateSubjectInput) {
  return prisma.subject.update({ where: { id }, data })
}

export function remove(id: string) {
  return prisma.subject.delete({ where: { id } })
}
