import { apiClient } from './client'
import type { Semester } from '@/types'

export interface ListSemestersParams {
  programId?: string
  search?: string
}

export interface SemesterInput {
  name: string
  programId: string
  year: number
  startDate: string
  endDate: string
}

export async function list(params?: ListSemestersParams): Promise<Semester[]> {
  const res = await apiClient.get<{ success: true; data: Semester[] }>('/semesters', { params })
  return res.data.data
}

export async function create(input: SemesterInput): Promise<Semester> {
  const res = await apiClient.post<{ success: true; data: Semester }>('/semesters', input)
  return res.data.data
}

export async function update(id: string, input: SemesterInput): Promise<Semester> {
  const res = await apiClient.patch<{ success: true; data: Semester }>(`/semesters/${id}`, input)
  return res.data.data
}

export async function remove(id: string): Promise<void> {
  await apiClient.delete(`/semesters/${id}`)
}
