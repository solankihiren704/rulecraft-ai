import type { Subject as PrismaSubject } from '@prisma/client'
import type { Subject } from '@/types'

export function toSubject(row: PrismaSubject): Subject {
  return { id: row.id, code: row.code, name: row.name, credits: row.credits, semesterId: row.semesterId }
}
