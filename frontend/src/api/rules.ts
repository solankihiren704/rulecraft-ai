import { apiClient } from './client'
import type { ConditionNode, Rule, RuleType } from '@/types'

export interface ListRulesParams {
  regulationId?: string
  type?: RuleType
  active?: boolean
}

export interface CreateRuleInput {
  name: string
  regulationId: string
  type: RuleType
  outcome: string
  active: boolean
  conditionTree: ConditionNode
}

// A rule's parent regulation is fixed at creation — see backend
// rules.validators.ts. To change which regulation a rule belongs to,
// duplicate the regulation and recreate the rule there.
export type UpdateRuleInput = Omit<CreateRuleInput, 'regulationId'>

export async function list(params?: ListRulesParams): Promise<Rule[]> {
  const res = await apiClient.get<{ success: true; data: Rule[] }>('/rules', { params })
  return res.data.data
}

export async function getById(id: string): Promise<Rule> {
  const res = await apiClient.get<{ success: true; data: Rule }>(`/rules/${id}`)
  return res.data.data
}

export async function create(input: CreateRuleInput): Promise<Rule> {
  const res = await apiClient.post<{ success: true; data: Rule }>('/rules', input)
  return res.data.data
}

export async function update(id: string, input: UpdateRuleInput): Promise<Rule> {
  const res = await apiClient.patch<{ success: true; data: Rule }>(`/rules/${id}`, input)
  return res.data.data
}

export async function remove(id: string): Promise<void> {
  await apiClient.delete(`/rules/${id}`)
}

export async function toggleActive(id: string): Promise<Rule> {
  const res = await apiClient.patch<{ success: true; data: Rule }>(`/rules/${id}/toggle`)
  return res.data.data
}
