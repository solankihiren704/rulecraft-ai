import { apiClient } from './client'
import type { Program } from '@/types'

export interface ListProgramsParams {
  departmentId?: string
  search?: string
}

export interface ProgramInput {
  name: string
  code: string
  departmentId: string
  years: number
}

export async function list(params?: ListProgramsParams): Promise<Program[]> {
  const res = await apiClient.get<{ success: true; data: Program[] }>('/programs', { params })
  return res.data.data
}

export async function create(input: ProgramInput): Promise<Program> {
  const res = await apiClient.post<{ success: true; data: Program }>('/programs', input)
  return res.data.data
}

export async function update(id: string, input: ProgramInput): Promise<Program> {
  const res = await apiClient.patch<{ success: true; data: Program }>(`/programs/${id}`, input)
  return res.data.data
}

export async function remove(id: string): Promise<void> {
  await apiClient.delete(`/programs/${id}`)
}
