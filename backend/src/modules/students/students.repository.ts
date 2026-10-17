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

// Richer than detailInclude — needs the program AND department *names* for
// the export table, not just departmentId for the visibility check.
export function findManyByIds(ids: string[]) {
  return prisma.student.findMany({
    where: { id: { in: ids } },
    include: { program: { include: { department: { select: { name: true } } } } },
    orderBy: { name: 'asc' },
  })
}

export function findByEmail(email: string) {
  return prisma.student.findUnique({ where: { email: email.toLowerCase() } })
}

export function findByStudentId(studentId: string) {
  return prisma.student.findUnique({ where: { studentId } })
}

export function create(data: CreateStudentInput & { userId?: string }) {
  return prisma.student.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      studentId: data.studentId,
      programId: data.programId,
      year: data.year,
      status: data.status,
      gpa: data.gpa,
      attendance: data.attendance ?? 85,
      enrollDate: new Date(),
      userId: data.userId,
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
      attendance: data.attendance,
    },
  })
}

export function remove(id: string) {
  return prisma.student.delete({ where: { id } })
}

export function findExisting(emails: string[], studentIds: string[]) {
  return prisma.student.findMany({
    where: { OR: [{ email: { in: emails } }, { studentId: { in: studentIds } }] },
    select: { email: true, studentId: true },
  })
}

export interface ImportRow {
  name: string
  email: string
  studentId: string
  programId: string
  year: number
  status: StudentStatus
  gpa: number
  attendance?: number
  enrollDate: Date
  userId?: string
}

export function createMany(rows: ImportRow[]) {
  return prisma.student.createMany({ data: rows })
}

export function findResultStudentById(id: string) {
  return prisma.student.findFirst({
    where: {
      OR: [{ id }, { studentId: id }, { userId: id }],
    },
    include: {
      program: {
        include: {
          department: true,
          semesters: {
            include: {
              subjects: true,
            },
            orderBy: { year: 'asc' },
          },
          regulations: {
            where: { status: 'published' },
            include: { rules: { where: { active: true } } },
          },
        },
      },
    },
  })
}
