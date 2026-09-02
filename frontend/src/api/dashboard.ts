import { apiClient } from './client'
import type { DashboardSummary } from '@/types'

export async function summary(): Promise<DashboardSummary> {
  const res = await apiClient.get<{ success: true; data: DashboardSummary }>('/dashboard/summary')
  return res.data.data
}
