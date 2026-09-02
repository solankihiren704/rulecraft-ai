import type { Program as PrismaProgram } from '@prisma/client'
import type { Program } from '@/types'

export function toProgram(row: PrismaProgram): Program {
  return { id: row.id, name: row.name, code: row.code, departmentId: row.departmentId, years: row.years }
}
