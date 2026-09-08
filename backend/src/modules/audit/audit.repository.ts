import { prisma } from '@/config/prisma'
import type { Prisma } from '@prisma/client'

/**
 * audit.repository.ts
 * Thin wrapper around the AuditLog table (already in schema.prisma, unused
 * until now) — a generic entityType/entityId/action/metadata log rather
 * than a bespoke table per audited thing, so any module can record who did
 * what without its own migration.
 */
export interface RecordAuditEntryInput {
  userId: string
  action: string
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
}

export function record(entry: RecordAuditEntryInput) {
  return prisma.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata as Prisma.InputJsonValue | undefined,
    },
  })
}

// Filters by a regulationId embedded in each entry's own metadata (set at
// write time) rather than joining against currently-existing rule rows —
// a rule that's since been deleted still shows up in its regulation's
// history this way, which is the whole point of an audit trail.
export function listForRegulationRules(regulationId: string) {
  return prisma.auditLog.findMany({
    where: {
      entityType: 'rule',
      metadata: { path: ['regulationId'], equals: regulationId },
    },
    include: { user: { select: { name: true } } },
    orderBy: { at: 'desc' },
  })
}
