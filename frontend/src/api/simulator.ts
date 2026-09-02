import { apiClient } from './client'
import type { SimulationResult } from '@/types'

export interface RunSimulationInput {
  regulationId: string
  studentId?: string
  customValues: Record<string, string>
}

export interface ListHistoryParams {
  regulationId?: string
  studentId?: string
}

export async function run(input: RunSimulationInput): Promise<SimulationResult> {
  const res = await apiClient.post<{ success: true; data: SimulationResult }>('/simulator/run', input)
  return res.data.data
}

export async function history(params?: ListHistoryParams): Promise<SimulationResult[]> {
  const res = await apiClient.get<{ success: true; data: SimulationResult[] }>('/simulator/history', { params })
  return res.data.data
}
