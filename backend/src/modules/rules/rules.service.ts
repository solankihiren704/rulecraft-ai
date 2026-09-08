import { ApiError } from '@/middleware/errorHandler'
import * as auditRepo from '@/modules/audit/audit.repository'
import type { Role } from '@/types'
import * as repo from './rules.repository'
import { toRule } from './rules.mapper'
import type { CreateRuleInput, ListRulesQuery, UpdateRuleInput } from './rules.validators'

const STAFF_WITH_FULL_VISIBILITY: Role[] = ['super_admin', 'registrar', 'hod']

export async function list(query: ListRulesQuery, role: Role) {
  const visibleRegulationStatuses = STAFF_WITH_FULL_VISIBILITY.includes(role) ? undefined : ['published']
  const rows = await repo.list({ ...query, visibleRegulationStatuses })
  return rows.map(toRule)
}

export async function getById(id: string, role: Role) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Rule not found')

  const visible = STAFF_WITH_FULL_VISIBILITY.includes(role) || row.regulation.status === 'published'
  if (!visible) throw new ApiError(404, 'Rule not found')
  return toRule(row)
}

async function assertRegulationIsDraft(regulationId: string) {
  const regulation = await repo.findRegulationStatus(regulationId)
  if (!regulation) throw new ApiError(400, 'That regulation does not exist.', { regulationId: 'Invalid regulation.' })
  if (regulation.status !== 'draft') {
    throw new ApiError(409, 'Rules can only be changed while their regulation is in draft. Duplicate the regulation to make changes.')
  }
}

async function assertParentIsDraft(ruleId: string) {
  const row = await repo.findById(ruleId)
  if (!row) throw new ApiError(404, 'Rule not found')
  if (row.regulation.status !== 'draft') {
    throw new ApiError(409, 'Rules can only be changed while their regulation is in draft. Duplicate the regulation to make changes.')
  }
  return row
}

function logRuleAudit(userId: string, action: string, rule: { id: string; name: string; regulationId: string }) {
  return auditRepo.record({
    userId,
    action,
    entityType: 'rule',
    entityId: rule.id,
    metadata: { ruleName: rule.name, regulationId: rule.regulationId },
  })
}

export async function create(input: CreateRuleInput, userId: string) {
  await assertRegulationIsDraft(input.regulationId)
  const row = await repo.create(input)
  await logRuleAudit(userId, 'rule.created', row)
  return toRule(row)
}

export async function update(id: string, input: UpdateRuleInput, userId: string) {
  await assertParentIsDraft(id)
  const row = await repo.update(id, input)
  await logRuleAudit(userId, 'rule.updated', row)
  return toRule(row)
}

export async function remove(id: string, userId: string) {
  const current = await assertParentIsDraft(id)
  await repo.remove(id)
  await logRuleAudit(userId, 'rule.deleted', current)
}

export async function toggleActive(id: string, userId: string) {
  const current = await repo.findById(id)
  if (!current) throw new ApiError(404, 'Rule not found')
  if (current.regulation.status !== 'draft') {
    throw new ApiError(409, 'Rules can only be changed while their regulation is in draft. Duplicate the regulation to make changes.')
  }
  const row = await repo.toggleActive(id, !current.active)
  await logRuleAudit(userId, row.active ? 'rule.activated' : 'rule.deactivated', row)
  return toRule(row)
}
