import type { Rule as PrismaRule } from '@prisma/client'
import type { ConditionNode, Rule } from '@/types'

export function toRule(row: PrismaRule): Rule {
  return {
    id: row.id,
    regulationId: row.regulationId,
    name: row.name,
    type: row.type,
    outcome: row.outcome,
    active: row.active,
    // Prisma types a Json column as the broad JsonValue — safe to narrow
    // here because every write path goes through conditionNodeSchema
    // (rules.validators.ts), so anything persisted already matches this shape.
    conditionTree: row.conditionTree as unknown as ConditionNode,
  }
}
