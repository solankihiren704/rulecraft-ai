import type { Semester as PrismaSemester } from '@prisma/client'
import type { Semester } from '@/types'
import { toDateOnly } from '@/utils/date'

export function toSemester(row: PrismaSemester): Semester {
  return {
    id: row.id,
    name: row.name,
    programId: row.programId,
    year: row.year,
    startDate: toDateOnly(row.startDate),
    endDate: toDateOnly(row.endDate),
  }
}
