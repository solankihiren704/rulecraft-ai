import { prisma } from '@/config/prisma'
import type { Prisma, RegulationStatus } from '@prisma/client'
import type { CreateRegulationInput, UpdateRegulationInput } from './regulations.validators'

export const detailInclude = {
  versions: { orderBy: { changedAt: 'desc' as const }, include: { changedBy: true } },
  approvalHistory: { orderBy: { at: 'asc' as const }, include: { by: true } },
  _count: { select: { rules: true } },
}

export interface RegulationSnapshot {
  name: string
  description: string
  effectiveDate: string
  rules: { id: string; name: string; type: string; outcome: string; active: boolean; conditionTree: unknown }[]
}

export function list(filters: {
  status?: RegulationStatus
  programId?: string
  departmentId?: string
  search?: string
  visibleStatuses?: RegulationStatus[]
}) {
  return prisma.regulation.findMany({
    where: {
      status: filters.status ?? (filters.visibleStatuses ? { in: filters.visibleStatuses } : undefined),
      programId: filters.programId,
      program: filters.departmentId ? { departmentId: filters.departmentId } : undefined,
      name: filters.search ? { contains: filters.search, mode: 'insensitive' } : undefined,
    },
    include: detailInclude,
    orderBy: { lastModified: 'desc' },
  })
}

export function findById(id: string) {
  return prisma.regulation.findUnique({
    where: { id },
    include: {
      ...detailInclude,
      program: { select: { departmentId: true, name: true, code: true } },
    },
  })
}

export function findByCode(code: string) {
  return prisma.regulation.findUnique({ where: { code } })
}

export function create(input: CreateRegulationInput, createdById: string) {
  // A brand-new draft has no rules yet (they're added afterward in the Rule
  // Engine), so this snapshot is trivially { rules: [] } — still the real
  // state at that moment, not a placeholder.
  const snapshot: RegulationSnapshot = {
    name: input.name,
    description: input.description,
    effectiveDate: input.effectiveDate,
    rules: [],
  }
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
        create: [
          {
            version: '1.0',
            changeSummary: 'Initial draft created.',
            changedById: createdById,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
          },
        ],
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

export function publishNewVersion(
  id: string,
  version: string,
  changeSummary: string,
  changedById: string,
  snapshot: RegulationSnapshot,
) {
  return prisma.regulation.update({
    where: { id },
    data: {
      status: 'published',
      version,
      versions: {
        create: [{ version, changeSummary, changedById, snapshot: snapshot as unknown as Prisma.InputJsonValue }],
      },
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

  // Two steps, not one nested create: the snapshot needs the NEW rule rows'
  // own ids (what later diffs match rules by), and those don't exist until
  // after this insert runs — copying source.rules[i].id here would silently
  // snapshot the wrong regulation's rule ids, making every rule look like
  // an add+remove pair instead of "unchanged" in any future diff.
  const created = await prisma.regulation.create({
    data: {
      name: `${source.name} (copy)`,
      code: newCode,
      programId: source.programId,
      effectiveDate: source.effectiveDate,
      description: source.description,
      version: '1.0',
      status: 'draft',
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
    include: { rules: true },
  })

  const snapshot: RegulationSnapshot = {
    name: created.name,
    description: created.description,
    effectiveDate: created.effectiveDate.toISOString(),
    rules: created.rules.map((r) => ({ id: r.id, name: r.name, type: r.type, outcome: r.outcome, active: r.active, conditionTree: r.conditionTree })),
  }
  await prisma.regulationVersion.create({
    data: {
      regulationId: created.id,
      version: '1.0',
      changeSummary: `Duplicated from ${source.code}.`,
      changedById: createdById,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
  })

  return prisma.regulation.findUnique({ where: { id: created.id }, include: detailInclude })
}

// Fetches both version rows (with their raw snapshots) for a diff — a
// dedicated query rather than reusing detailInclude, since the diff needs
// the actual snapshot JSON that the regular regulation-detail response
// deliberately omits (toRegulation only exposes hasSnapshot, a boolean).
export function findVersionsForDiff(regulationId: string, versionIds: string[]) {
  return prisma.regulationVersion.findMany({
    where: { regulationId, id: { in: versionIds } },
  })
}
