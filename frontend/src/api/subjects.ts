import { apiClient } from './client'
import type { Subject } from '@/types'

export interface ListSubjectsParams {
  semesterId?: string
  search?: string
}

export interface SubjectInput {
  code: string
  name: string
  credits: number
  semesterId: string
}

export async function list(params?: ListSubjectsParams): Promise<Subject[]> {
  const res = await apiClient.get<{ success: true; data: Subject[] }>('/subjects', { params })
  return res.data.data
}

export async function create(input: SubjectInput): Promise<Subject> {
  const res = await apiClient.post<{ success: true; data: Subject }>('/subjects', input)
  return res.data.data
}

export async function update(id: string, input: SubjectInput): Promise<Subject> {
  const res = await apiClient.patch<{ success: true; data: Subject }>(`/subjects/${id}`, input)
  return res.data.data
}

export async function remove(id: string): Promise<void> {
  await apiClient.delete(`/subjects/${id}`)
}
