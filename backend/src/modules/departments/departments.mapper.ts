import type { Department as PrismaDepartment } from '@prisma/client'
import type { Department } from '@/types'

export function toDepartment(row: PrismaDepartment): Department {
  return { id: row.id, name: row.name, code: row.code }
}
