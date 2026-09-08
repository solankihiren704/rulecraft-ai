import { prisma } from '@/config/prisma'
import type { CreateSemesterInput, UpdateSemesterInput } from './semesters.validators'

function toPrismaData(input: CreateSemesterInput) {
  return {
    name: input.name,
    programId: input.programId,
    year: input.year,
    startDate: new Date(input.startDate),
    endDate: new Date(input.endDate),
  }
}

export function list(filters: { programId?: string; search?: string }) {
  return prisma.semester.findMany({
    where: {
      programId: filters.programId,
      name: filters.search ? { contains: filters.search, mode: 'insensitive' } : undefined,
    },
    orderBy: [{ year: 'asc' }, { name: 'asc' }],
  })
}

export function findById(id: string) {
  return prisma.semester.findUnique({ where: { id } })
}

// No unique constraint on Semester in the schema (unlike Department/Program
// code or Subject's (semesterId, code)) — (programId, name) is the natural
// de-dup key for bulk import, matching how a semester is actually named in
// practice ("Semester 1" within a given program).
export function findByProgramAndName(programId: string, name: string) {
  return prisma.semester.findFirst({ where: { programId, name: { equals: name, mode: 'insensitive' } } })
}

export function create(input: CreateSemesterInput) {
  return prisma.semester.create({ data: toPrismaData(input) })
}

export function update(id: string, input: UpdateSemesterInput) {
  return prisma.semester.update({ where: { id }, data: toPrismaData(input) })
}

export function remove(id: string) {
  return prisma.semester.delete({ where: { id } })
}

export function countSubjects(semesterId: string) {
  return prisma.subject.count({ where: { semesterId } })
}
