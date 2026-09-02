import type { SimulationBreakdownItem, SimulationResult as PrismaSimulationResult } from '@prisma/client'
import type { SimulationResult } from '@/types'

type SimulationWithBreakdown = PrismaSimulationResult & { breakdown: SimulationBreakdownItem[] }

export function toSimulationResult(row: SimulationWithBreakdown): SimulationResult {
  return {
    id: row.id,
    studentId: row.studentId ?? 'custom',
    studentName: row.studentName,
    regulationId: row.regulationId,
    ranAt: row.ranAt.toISOString(),
    outcome: row.outcome,
    breakdown: row.breakdown.map((b) => ({ rule: b.ruleName, passed: b.passed, detail: b.detail })),
  }
}
