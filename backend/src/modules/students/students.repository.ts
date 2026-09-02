import { prisma } from '@/config/prisma'
import type { StudentStatus } from '@prisma/client'
import type { CreateStudentInput, UpdateStudentInput } from './students.validators'

export interface StudentFilters {
  search?: string
  programId?: string
  year?: number
  status?: StudentStatus
  // Row-level scoping applied by the service based on the caller's role —
  // never taken directly from client-supplied query params.
  departmentId?: string
  userId?: string
}

export const detailInclude = {
  program: { select: { departmentId: true } },
}

export function list(filters: StudentFilters) {
  return prisma.student.findMany({
    where: {
      programId: filters.programId,
      year: filters.year,
      status: filters.status,
      userId: filters.userId,
      program: filters.departmentId ? { departmentId: filters.departmentId } : undefined,
      OR: filters.search
        ? [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
            { studentId: { contains: filters.search, mode: 'insensitive' } },
          ]
        : undefined,
    },
    orderBy: { name: 'asc' },
  })
}

export function findById(id: string) {
  return prisma.student.findUnique({ where: { id }, include: detailInclude })
}

export function findByEmail(email: string) {
  return prisma.student.findUnique({ where: { email: email.toLowerCase() } })
}

export function findByStudentId(studentId: string) {
  return prisma.student.findUnique({ where: { studentId } })
}

export function create(data: CreateStudentInput) {
  return prisma.student.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      studentId: data.studentId,
      programId: data.programId,
      year: data.year,
      status: data.status,
      gpa: data.gpa,
      enrollDate: new Date(),
    },
  })
}

export function update(id: string, data: UpdateStudentInput) {
  return prisma.student.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      studentId: data.studentId,
      programId: data.programId,
      year: data.year,
      status: data.status,
      gpa: data.gpa,
    },
  })
}

export function remove(id: string) {
  return prisma.student.delete({ where: { id } })
}
