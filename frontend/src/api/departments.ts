import { apiClient } from './client'
import type { Department } from '@/types'

export interface ListDepartmentsParams {
  search?: string
}

export async function list(params?: ListDepartmentsParams): Promise<Department[]> {
  const res = await apiClient.get<{ success: true; data: Department[] }>('/departments', { params })
  return res.data.data
}
