import type { ApprovalStep, RegulationVersion, User } from '@prisma/client'
import type { Regulation } from '@/types'
import { toDateOnly } from '@/utils/date'

type RegulationWithDetail = {
  id: string
  name: string
  code: string
  version: string
  status: Regulation['status']
  effectiveDate: Date
  lastModified: Date
  programId: string
  description: string
  versions: (RegulationVersion & { changedBy: User })[]
  approvalHistory: (ApprovalStep & { by: User })[]
  _count: { rules: number }
}

export function toRegulation(row: RegulationWithDetail): Regulation & { ruleCount: number } {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    version: row.version,
    status: row.status,
    effectiveDate: toDateOnly(row.effectiveDate),
    lastModified: toDateOnly(row.lastModified),
    programId: row.programId,
    description: row.description,
    versions: row.versions.map((v) => ({
      version: v.version,
      changeSummary: v.changeSummary,
      changedBy: v.changedBy.name,
      changedAt: toDateOnly(v.changedAt),
    })),
    approvalHistory: row.approvalHistory.map((step) => ({
      step: step.step,
      by: step.by.name,
      at: step.at.toISOString(),
      ...(step.note ? { note: step.note } : {}),
    })),
    // Bonus field, additive to the Regulation type — lets the regulations
    // list page show a rule count without an extra request per row.
    ruleCount: row._count.rules,
  }
}
