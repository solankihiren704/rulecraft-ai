import { apiClient } from './client'
import type { SimulationOutcome, SimulationResult } from '@/types'

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

export interface BatchSimulationInput {
  regulationId: string
  studentIds: string[]
  customValues: Record<string, string>
}

export interface BatchStudentOutcome {
  studentId: string
  studentName: string
  outcome: SimulationOutcome | null
  error?: string
}

export interface BatchRuleTally {
  rule: string
  passed: number
  failed: number
}

export interface BatchSimulationSummary {
  regulationId: string
  totalStudents: number
  succeeded: number
  failed: number
  outcomeCounts: Record<SimulationOutcome, number>
  ruleBreakdown: BatchRuleTally[]
  results: BatchStudentOutcome[]
}

export async function runBatch(input: BatchSimulationInput): Promise<BatchSimulationSummary> {
  const res = await apiClient.post<{ success: true; data: BatchSimulationSummary }>('/simulator/batch', input)
  return res.data.data
}
