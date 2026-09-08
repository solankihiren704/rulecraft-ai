import { apiClient } from './client'
import type { Department } from '@/types'

export interface ListDepartmentsParams {
  search?: string
}

export interface DepartmentInput {
  name: string
  code: string
}

export async function list(params?: ListDepartmentsParams): Promise<Department[]> {
  const res = await apiClient.get<{ success: true; data: Department[] }>('/departments', { params })
  return res.data.data
}

export async function create(input: DepartmentInput): Promise<Department> {
  const res = await apiClient.post<{ success: true; data: Department }>('/departments', input)
  return res.data.data
}

export async function update(id: string, input: DepartmentInput): Promise<Department> {
  const res = await apiClient.patch<{ success: true; data: Department }>(`/departments/${id}`, input)
  return res.data.data
}

export async function remove(id: string): Promise<void> {
  await apiClient.delete(`/departments/${id}`)
}
