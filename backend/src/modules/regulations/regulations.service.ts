import crypto from 'node:crypto'
import type { RegulationStatus } from '@prisma/client'
import { ApiError } from '@/middleware/errorHandler'
import { findById as findProgramById } from '@/modules/programs/programs.repository'
import * as auditRepo from '@/modules/audit/audit.repository'
import * as rulesRepo from '@/modules/rules/rules.repository'
import { findRuleConflicts } from '@/rule-engine/conflicts'
import { describeNode } from '@/rule-engine/evaluate'
import type { Role, RuleAuditEntry, RuleConflict, ConditionNode, RegulationVersionDiff, VersionDiffRuleSummary } from '@/types'
import * as repo from './regulations.repository'
import type { RegulationSnapshot } from './regulations.repository'
import { toRegulation } from './regulations.mapper'
import type { CreateRegulationInput, ListRegulationsQuery, UpdateRegulationInput } from './regulations.validators'

const STAFF_WITH_FULL_VISIBILITY: Role[] = ['super_admin', 'registrar', 'hod']

function visibleStatusesFor(role: Role): RegulationStatus[] | undefined {
  return STAFF_WITH_FULL_VISIBILITY.includes(role) ? undefined : ['published']
}

export async function list(
  query: ListRegulationsQuery,
  user: { role: Role; departmentId: string | null }
) {
  const departmentId =
    user.role === 'hod' || user.role === 'faculty' ? (user.departmentId ?? undefined) : undefined
  const rows = await repo.list({
    ...query,
    departmentId,
    visibleStatuses: visibleStatusesFor(user.role),
  })
  return rows.map(toRegulation)
}

export async function getById(
  id: string,
  user: { role: Role; departmentId: string | null }
) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Regulation not found')

  const visible = visibleStatusesFor(user.role)
  if (visible && !visible.includes(row.status)) {
    throw new ApiError(404, 'Regulation not found')
  }

  if (user.role === 'hod' || user.role === 'faculty') {
    if (user.departmentId && row.program?.departmentId !== user.departmentId) {
      throw new ApiError(403, 'Access denied: This regulation belongs to another academic department.')
    }
  }

  return toRegulation(row)
}

async function assertProgramExists(programId: string) {
  const program = await findProgramById(programId)
  if (!program) throw new ApiError(400, 'That program does not exist.', { programId: 'Invalid program.' })
}

async function assertCodeAvailable(code: string) {
  const existing = await repo.findByCode(code)
  if (existing) throw new ApiError(409, `Code "${code}" is already in use.`, { code: 'Already in use.' })
}

export async function create(input: CreateRegulationInput, createdById: string) {
  await assertProgramExists(input.programId)
  await assertCodeAvailable(input.code)
  const row = await repo.create(input, createdById)
  return toRegulation(row)
}

async function getOwnedDraftOrThrow(id: string) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Regulation not found')
  if (row.status !== 'draft') {
    throw new ApiError(409, 'Published regulations are immutable. Duplicate this regulation to make changes.')
  }
  return row
}

export async function update(id: string, input: UpdateRegulationInput) {
  const current = await getOwnedDraftOrThrow(id)
  await assertProgramExists(input.programId)
  if (input.code !== current.code) await assertCodeAvailable(input.code)
  const row = await repo.update(id, input)
  return toRegulation(row)
}

export async function remove(id: string) {
  await getOwnedDraftOrThrow(id)
  await repo.remove(id)
}

export async function submit(id: string, byId: string) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Regulation not found')
  if (row.status !== 'draft') throw new ApiError(409, `Cannot submit a regulation that is already "${row.status}".`)

  await repo.setStatus(id, 'review')
  await repo.addApprovalStep(id, 'submitted', byId, 'Submitted for HOD/Council review.')
  return toRegulation((await repo.findById(id))!)
}

export async function review(
  id: string,
  user: { id: string; role: Role; departmentId: string | null },
  note: string | undefined
) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Regulation not found')
  if (row.status !== 'review') throw new ApiError(409, 'Only regulations under review can be reviewed.')

  if (user.role === 'hod' && user.departmentId && row.program?.departmentId !== user.departmentId) {
    throw new ApiError(403, 'Access denied: You can only review regulations within your assigned department.')
  }

  await repo.addApprovalStep(id, 'reviewed', user.id, note)
  return toRegulation((await repo.findById(id))!)
}

function bumpMinorVersion(version: string) {
  const [major, minor] = version.split('.').map(Number)
  return `${major}.${(minor || 0) + 1}`
}

async function buildSnapshot(regulation: { name: string; description: string; effectiveDate: Date }, regulationId: string) {
  const activeRules = await rulesRepo.list({ regulationId, active: true })
  return {
    name: regulation.name,
    description: regulation.description,
    effectiveDate: regulation.effectiveDate.toISOString(),
    rules: activeRules.map((r) => ({ id: r.id, name: r.name, type: r.type, outcome: r.outcome, active: r.active, conditionTree: r.conditionTree })),
  }
}

export async function approve(id: string, byId: string) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Regulation not found')
  if (row.status !== 'review') throw new ApiError(409, 'Only regulations under review can be approved.')

  const nextVersion = bumpMinorVersion(row.version)
  const snapshot = await buildSnapshot(row, id)
  await repo.publishNewVersion(id, nextVersion, 'Approved and published by Academic Council.', byId, snapshot)
  await repo.addApprovalStep(id, 'approved', byId)
  return toRegulation((await repo.findById(id))!)
}

export async function reject(
  id: string,
  user: { id: string; role: Role; departmentId: string | null },
  note: string
) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Regulation not found')
  if (row.status !== 'review') throw new ApiError(409, 'Only regulations under review can be rejected.')

  if (user.role === 'hod' && user.departmentId && row.program?.departmentId !== user.departmentId) {
    throw new ApiError(403, 'Access denied: You can only reject regulations within your assigned department.')
  }

  await repo.setStatus(id, 'draft')
  await repo.addApprovalStep(id, 'rejected', user.id, note)
  return toRegulation((await repo.findById(id))!)
}

export async function archive(id: string) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Regulation not found')
  if (row.status === 'archived') throw new ApiError(409, 'This regulation is already archived.')

  const updated = await repo.setStatus(id, 'archived')
  return toRegulation(updated)
}

export async function duplicate(id: string, createdById: string) {
  const source = await repo.findById(id)
  if (!source) throw new ApiError(404, 'Regulation not found')

  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  const newCode = `${source.code}-COPY-${suffix}`
  const created = await repo.duplicate(id, newCode, createdById)
  return toRegulation(created!)
}

// Who drafted, edited, activated/deactivated, or deleted which rule on this
// regulation — complements the existing version history (regulation
// content changes) and approval workflow (submit/review/publish) tabs,
// neither of which touches individual-rule activity.
export async function getRuleAuditHistory(id: string, role: Role): Promise<RuleAuditEntry[]> {
  if (!STAFF_WITH_FULL_VISIBILITY.includes(role)) {
    throw new ApiError(403, 'You do not have permission to view rule activity history.')
  }
  const regulation = await repo.findById(id)
  if (!regulation) throw new ApiError(404, 'Regulation not found')

  const rows = await auditRepo.listForRegulationRules(id)
  return rows.map((row) => {
    const metadata = (row.metadata as { ruleName?: string } | null) ?? {}
    return {
      id: row.id,
      action: row.action,
      at: row.at.toISOString(),
      byName: row.user?.name ?? 'Unknown',
      ruleName: metadata.ruleName ?? 'Unknown rule',
    }
  })
}

// Heuristic same-field contradiction check across a regulation's active
// rules — see rule-engine/conflicts.ts for exactly what it can and can't
// catch. Scoped to active rules only: an inactive rule doesn't have to
// pass for the regulation to reach "eligible", so it can't create a real
// conflict for a live eligibility check.
export async function getRuleConflicts(id: string, role: Role): Promise<RuleConflict[]> {
  if (!STAFF_WITH_FULL_VISIBILITY.includes(role)) {
    throw new ApiError(403, 'You do not have permission to check rule conflicts.')
  }
  const regulation = await repo.findById(id)
  if (!regulation) throw new ApiError(404, 'Regulation not found')

  const activeRules = await rulesRepo.list({ regulationId: id, active: true })
  const inputs = activeRules.map((r) => ({ id: r.id, name: r.name, conditionTree: r.conditionTree as unknown as ConditionNode }))
  return findRuleConflicts(inputs)
}

// --- Version diff ---------------------------------------------------------

function ruleSummary(rule: RegulationSnapshot['rules'][number]): VersionDiffRuleSummary {
  return {
    id: rule.id,
    name: rule.name,
    outcome: rule.outcome,
    conditionSummary: describeNode(rule.conditionTree as ConditionNode),
  }
}

export async function getVersionDiff(regulationId: string, fromVersionId: string, toVersionId: string, role: Role): Promise<RegulationVersionDiff> {
  if (!STAFF_WITH_FULL_VISIBILITY.includes(role)) {
    throw new ApiError(403, 'You do not have permission to compare regulation versions.')
  }
  if (fromVersionId === toVersionId) {
    throw new ApiError(400, 'Select two different versions to compare.')
  }
  const regulation = await repo.findById(regulationId)
  if (!regulation) throw new ApiError(404, 'Regulation not found')

  const rows = await repo.findVersionsForDiff(regulationId, [fromVersionId, toVersionId])
  const versionA = rows.find((v) => v.id === fromVersionId)
  const versionB = rows.find((v) => v.id === toVersionId)
  if (!versionA || !versionB) throw new ApiError(404, 'One or both versions were not found on this regulation.')

  const side = (v: (typeof rows)[number]) => ({ id: v.id, version: v.version, changedAt: v.changedAt.toISOString(), hasSnapshot: v.snapshot != null })

  const snapshotA = versionA.snapshot as unknown as RegulationSnapshot | null
  const snapshotB = versionB.snapshot as unknown as RegulationSnapshot | null

  if (!snapshotA || !snapshotB) {
    // No fabricated comparison when either side has nothing captured —
    // that would be presenting a guess as a real diff.
    return { versionA: side(versionA), versionB: side(versionB), metadataChanges: [], rulesAdded: [], rulesRemoved: [], rulesChanged: [] }
  }

  const metadataChanges: RegulationVersionDiff['metadataChanges'] = []
  if (snapshotA.name !== snapshotB.name) metadataChanges.push({ field: 'Name', from: snapshotA.name, to: snapshotB.name })
  if (snapshotA.description !== snapshotB.description) {
    metadataChanges.push({ field: 'Description', from: snapshotA.description, to: snapshotB.description })
  }
  if (snapshotA.effectiveDate !== snapshotB.effectiveDate) {
    metadataChanges.push({ field: 'Effective date', from: snapshotA.effectiveDate.slice(0, 10), to: snapshotB.effectiveDate.slice(0, 10) })
  }

  const rulesA = new Map(snapshotA.rules.map((r) => [r.id, r]))
  const rulesB = new Map(snapshotB.rules.map((r) => [r.id, r]))

  const rulesAdded = snapshotB.rules.filter((r) => !rulesA.has(r.id)).map(ruleSummary)
  const rulesRemoved = snapshotA.rules.filter((r) => !rulesB.has(r.id)).map(ruleSummary)

  const rulesChanged: RegulationVersionDiff['rulesChanged'] = []
  for (const ruleA of snapshotA.rules) {
    const ruleB = rulesB.get(ruleA.id)
    if (!ruleB) continue
    const changes: string[] = []
    if (ruleA.name !== ruleB.name) changes.push(`Renamed from "${ruleA.name}" to "${ruleB.name}"`)
    if (ruleA.outcome !== ruleB.outcome) changes.push(`Outcome changed from "${ruleA.outcome}" to "${ruleB.outcome}"`)
    if (JSON.stringify(ruleA.conditionTree) !== JSON.stringify(ruleB.conditionTree)) {
      changes.push(`Conditions changed from "${describeNode(ruleA.conditionTree as ConditionNode)}" to "${describeNode(ruleB.conditionTree as ConditionNode)}"`)
    }
    if (changes.length > 0) rulesChanged.push({ id: ruleA.id, name: ruleB.name, changes })
  }

  return { versionA: side(versionA), versionB: side(versionB), metadataChanges, rulesAdded, rulesRemoved, rulesChanged }
}
