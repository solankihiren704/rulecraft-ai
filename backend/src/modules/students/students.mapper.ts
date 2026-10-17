import type { Student as PrismaStudent } from '@prisma/client'
import type { Student } from '@/types'
import { toDateOnly } from '@/utils/date'

export function toStudent(row: PrismaStudent): Student {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    studentId: row.studentId,
    programId: row.programId,
    year: row.year,
    status: row.status,
    gpa: row.gpa,
    attendance: row.attendance ?? 85,
    enrollDate: toDateOnly(row.enrollDate),
  }
}
