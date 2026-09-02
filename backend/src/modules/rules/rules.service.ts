import { ApiError } from '@/middleware/errorHandler'
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
}

export async function create(input: CreateRuleInput) {
  await assertRegulationIsDraft(input.regulationId)
  const row = await repo.create(input)
  return toRule(row)
}

export async function update(id: string, input: UpdateRuleInput) {
  await assertParentIsDraft(id)
  const row = await repo.update(id, input)
  return toRule(row)
}

export async function remove(id: string) {
  await assertParentIsDraft(id)
  await repo.remove(id)
}

export async function toggleActive(id: string) {
  const current = await repo.findById(id)
  if (!current) throw new ApiError(404, 'Rule not found')
  if (current.regulation.status !== 'draft') {
    throw new ApiError(409, 'Rules can only be changed while their regulation is in draft. Duplicate the regulation to make changes.')
  }
  const row = await repo.toggleActive(id, !current.active)
  return toRule(row)
}
