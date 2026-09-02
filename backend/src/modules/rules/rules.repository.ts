import { prisma } from '@/config/prisma'
import type { CreateRuleInput, ListRulesQuery, UpdateRuleInput } from './rules.validators'

export function list(filters: ListRulesQuery & { visibleRegulationStatuses?: string[] }) {
  return prisma.rule.findMany({
    where: {
      regulationId: filters.regulationId,
      type: filters.type,
      active: filters.active,
      regulation: filters.visibleRegulationStatuses ? { status: { in: filters.visibleRegulationStatuses as never[] } } : undefined,
    },
    include: { conditions: true },
    orderBy: { name: 'asc' },
  })
}

export function findById(id: string) {
  return prisma.rule.findUnique({ where: { id }, include: { conditions: true, regulation: { select: { status: true } } } })
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
      conditions: { create: input.conditions },
    },
    include: { conditions: true },
  })
}

export async function update(id: string, input: UpdateRuleInput) {
  return prisma.$transaction(async (tx) => {
    await tx.ruleCondition.deleteMany({ where: { ruleId: id } })
    return tx.rule.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        outcome: input.outcome,
        active: input.active,
        conditions: { create: input.conditions },
      },
      include: { conditions: true },
    })
  })
}

export function remove(id: string) {
  return prisma.rule.delete({ where: { id } })
}

export function toggleActive(id: string, active: boolean) {
  return prisma.rule.update({ where: { id }, data: { active }, include: { conditions: true } })
}
