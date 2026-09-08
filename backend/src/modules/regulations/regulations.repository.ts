import { prisma } from '@/config/prisma'
import type { RegulationStatus } from '@prisma/client'
import type { CreateRegulationInput, UpdateRegulationInput } from './regulations.validators'

export const detailInclude = {
  versions: { orderBy: { changedAt: 'desc' as const }, include: { changedBy: true } },
  approvalHistory: { orderBy: { at: 'asc' as const }, include: { by: true } },
  _count: { select: { rules: true } },
}

export function list(filters: { status?: RegulationStatus; programId?: string; search?: string; visibleStatuses?: RegulationStatus[] }) {
  return prisma.regulation.findMany({
    where: {
      status: filters.status ?? (filters.visibleStatuses ? { in: filters.visibleStatuses } : undefined),
      programId: filters.programId,
      name: filters.search ? { contains: filters.search, mode: 'insensitive' } : undefined,
    },
    include: detailInclude,
    orderBy: { lastModified: 'desc' },
  })
}

export function findById(id: string) {
  return prisma.regulation.findUnique({ where: { id }, include: detailInclude })
}

export function findByCode(code: string) {
  return prisma.regulation.findUnique({ where: { code } })
}

export function create(input: CreateRegulationInput, createdById: string) {
  return prisma.regulation.create({
    data: {
      name: input.name,
      code: input.code,
      programId: input.programId,
      effectiveDate: new Date(input.effectiveDate),
      description: input.description,
      version: '1.0',
      status: 'draft',
      versions: {
        create: [{ version: '1.0', changeSummary: 'Initial draft created.', changedById: createdById }],
      },
      approvalHistory: {
        create: [{ step: 'submitted', byId: createdById, note: 'Draft created, not yet submitted.' }],
      },
    },
    include: detailInclude,
  })
}

export function update(id: string, input: UpdateRegulationInput) {
  return prisma.regulation.update({
    where: { id },
    data: {
      name: input.name,
      code: input.code,
      programId: input.programId,
      effectiveDate: new Date(input.effectiveDate),
      description: input.description,
    },
    include: detailInclude,
  })
}

export function remove(id: string) {
  return prisma.regulation.delete({ where: { id } })
}

export function addApprovalStep(regulationId: string, step: import('@prisma/client').ApprovalStepName, byId: string, note?: string) {
  return prisma.approvalStep.create({ data: { regulationId, step, byId, note } })
}

export function setStatus(id: string, status: RegulationStatus) {
  return prisma.regulation.update({ where: { id }, data: { status }, include: detailInclude })
}

export function publishNewVersion(id: string, version: string, changeSummary: string, changedById: string) {
  return prisma.regulation.update({
    where: { id },
    data: {
      status: 'published',
      version,
      versions: { create: [{ version, changeSummary, changedById }] },
    },
    include: detailInclude,
  })
}

export async function duplicate(sourceId: string, newCode: string, createdById: string) {
  const source = await prisma.regulation.findUnique({
    where: { id: sourceId },
    include: { rules: true },
  })
  if (!source) return null

  return prisma.regulation.create({
    data: {
      name: `${source.name} (copy)`,
      code: newCode,
      programId: source.programId,
      effectiveDate: source.effectiveDate,
      description: source.description,
      version: '1.0',
      status: 'draft',
      versions: { create: [{ version: '1.0', changeSummary: `Duplicated from ${source.code}.`, changedById: createdById }] },
      approvalHistory: { create: [{ step: 'submitted', byId: createdById, note: 'Created via duplicate action.' }] },
      rules: {
        create: source.rules.map((rule) => ({
          name: rule.name,
          type: rule.type,
          outcome: rule.outcome,
          active: rule.active,
          conditionTree: rule.conditionTree as object,
        })),
      },
    },
    include: detailInclude,
  })
}
