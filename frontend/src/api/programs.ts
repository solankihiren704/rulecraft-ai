import { apiClient } from './client'
import type { Program } from '@/types'

export interface ListProgramsParams {
  departmentId?: string
  search?: string
}

export async function list(params?: ListProgramsParams): Promise<Program[]> {
  const res = await apiClient.get<{ success: true; data: Program[] }>('/programs', { params })
  return res.data.data
}
