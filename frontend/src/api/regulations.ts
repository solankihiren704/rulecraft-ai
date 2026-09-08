import { apiClient } from './client'
import type { Regulation, RegulationStatus, RegulationVersionDiff, RuleAuditEntry, RuleConflict } from '@/types'

// `ruleCount` is a bonus field the backend adds on top of the shared
// Regulation type (see backend/src/modules/regulations/regulations.mapper.ts)
// so the list page can show a rule count per row without an extra request.
export type RegulationWithRuleCount = Regulation & { ruleCount: number }

export interface ListRegulationsParams {
  status?: RegulationStatus
  programId?: string
  search?: string
}

export interface RegulationInput {
  name: string
  code: string
  programId: string
  effectiveDate: string
  description: string
}

export async function list(params?: ListRegulationsParams): Promise<RegulationWithRuleCount[]> {
  const res = await apiClient.get<{ success: true; data: RegulationWithRuleCount[] }>('/regulations', { params })
  return res.data.data
}

export async function getById(id: string): Promise<RegulationWithRuleCount> {
  const res = await apiClient.get<{ success: true; data: RegulationWithRuleCount }>(`/regulations/${id}`)
  return res.data.data
}

export async function create(input: RegulationInput): Promise<RegulationWithRuleCount> {
  const res = await apiClient.post<{ success: true; data: RegulationWithRuleCount }>('/regulations', input)
  return res.data.data
}

export async function update(id: string, input: RegulationInput): Promise<RegulationWithRuleCount> {
  const res = await apiClient.patch<{ success: true; data: RegulationWithRuleCount }>(`/regulations/${id}`, input)
  return res.data.data
}

export async function remove(id: string): Promise<void> {
  await apiClient.delete(`/regulations/${id}`)
}

export async function submit(id: string): Promise<RegulationWithRuleCount> {
  const res = await apiClient.post<{ success: true; data: RegulationWithRuleCount }>(`/regulations/${id}/submit`)
  return res.data.data
}

export async function approve(id: string): Promise<RegulationWithRuleCount> {
  const res = await apiClient.post<{ success: true; data: RegulationWithRuleCount }>(`/regulations/${id}/approve`)
  return res.data.data
}

export async function reject(id: string, note: string): Promise<RegulationWithRuleCount> {
  const res = await apiClient.post<{ success: true; data: RegulationWithRuleCount }>(`/regulations/${id}/reject`, { note })
  return res.data.data
}

export async function archive(id: string): Promise<RegulationWithRuleCount> {
  const res = await apiClient.post<{ success: true; data: RegulationWithRuleCount }>(`/regulations/${id}/archive`)
  return res.data.data
}

export async function duplicate(id: string): Promise<RegulationWithRuleCount> {
  const res = await apiClient.post<{ success: true; data: RegulationWithRuleCount }>(`/regulations/${id}/duplicate`)
  return res.data.data
}

export async function getRuleAuditHistory(id: string): Promise<RuleAuditEntry[]> {
  const res = await apiClient.get<{ success: true; data: RuleAuditEntry[] }>(`/regulations/${id}/rule-audit`)
  return res.data.data
}

export async function getConflicts(id: string): Promise<RuleConflict[]> {
  const res = await apiClient.get<{ success: true; data: RuleConflict[] }>(`/regulations/${id}/conflicts`)
  return res.data.data
}

export async function getVersionDiff(id: string, fromVersionId: string, toVersionId: string): Promise<RegulationVersionDiff> {
  const res = await apiClient.get<{ success: true; data: RegulationVersionDiff }>(`/regulations/${id}/version-diff`, {
    params: { fromVersionId, toVersionId },
  })
  return res.data.data
}
