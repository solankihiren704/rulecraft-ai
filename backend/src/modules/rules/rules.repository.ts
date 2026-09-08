import type { Prisma } from '@prisma/client'
import { prisma } from '@/config/prisma'
import type { CreateRuleInput, ListRulesQuery, UpdateRuleInput } from './rules.validators'

// conditionNodeSchema's output is an exact-shape TS union (no index
// signature), which Prisma's Json input type doesn't structurally accept —
// this is a type-system-only mismatch, not a runtime one, since the value
// really is plain JSON-serializable data validated on the way in.
function asJsonInput(tree: CreateRuleInput['conditionTree']): Prisma.InputJsonValue {
  return tree as unknown as Prisma.InputJsonValue
}

export function list(filters: ListRulesQuery & { visibleRegulationStatuses?: string[] }) {
  return prisma.rule.findMany({
    where: {
      regulationId: filters.regulationId,
      type: filters.type,
      active: filters.active,
      regulation: filters.visibleRegulationStatuses ? { status: { in: filters.visibleRegulationStatuses as never[] } } : undefined,
    },
    orderBy: { name: 'asc' },
  })
}

export function findById(id: string) {
  return prisma.rule.findUnique({ where: { id }, include: { regulation: { select: { status: true } } } })
}

export function findRegulationStatus(regulationId: string) {
  return prisma.regulation.findUnique({ where: { id: regulationId }, select: { status: true } })
}

export function create(input: CreateRuleInput) {
  return prisma.rule.create({
    data: {
      name: input.name,
      regulationId: input.regulationId,
      type: input.type,
      outcome: input.outcome,
      active: input.active,
      conditionTree: asJsonInput(input.conditionTree),
    },
  })
}

export function update(id: string, input: UpdateRuleInput) {
  return prisma.rule.update({
    where: { id },
    data: {
      name: input.name,
      type: input.type,
      outcome: input.outcome,
      active: input.active,
      conditionTree: asJsonInput(input.conditionTree),
    },
  })
}

export function remove(id: string) {
  return prisma.rule.delete({ where: { id } })
}

export function toggleActive(id: string, active: boolean) {
  return prisma.rule.update({ where: { id }, data: { active } })
}
