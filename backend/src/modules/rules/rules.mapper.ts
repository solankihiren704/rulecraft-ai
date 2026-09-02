import type { Rule as PrismaRule, RuleCondition } from '@prisma/client'
import type { Rule } from '@/types'

type RuleWithConditions = PrismaRule & { conditions: RuleCondition[] }

export function toRule(row: RuleWithConditions): Rule {
  return {
    id: row.id,
    regulationId: row.regulationId,
    name: row.name,
    type: row.type,
    outcome: row.outcome,
    active: row.active,
    conditions: row.conditions.map((c) => ({ id: c.id, field: c.field, operator: c.operator, value: c.value })),
  }
}
