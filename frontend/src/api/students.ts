import { apiClient } from './client'
import type { Student, StudentStatus } from '@/types'

export interface ListStudentsParams {
  search?: string
  programId?: string
  year?: number
  status?: StudentStatus
}

export interface StudentInput {
  name: string
  email: string
  studentId: string
  programId: string
  year: number
  status: StudentStatus
  gpa: number
}

export async function list(params?: ListStudentsParams): Promise<Student[]> {
  const res = await apiClient.get<{ success: true; data: Student[] }>('/students', { params })
  return res.data.data
}

export async function getById(id: string): Promise<Student> {
  const res = await apiClient.get<{ success: true; data: Student }>(`/students/${id}`)
  return res.data.data
}

export async function create(input: StudentInput): Promise<Student> {
  const res = await apiClient.post<{ success: true; data: Student }>('/students', input)
  return res.data.data
}

export async function update(id: string, input: StudentInput): Promise<Student> {
  const res = await apiClient.patch<{ success: true; data: Student }>(`/students/${id}`, input)
  return res.data.data
}

export async function remove(id: string): Promise<void> {
  await apiClient.delete(`/students/${id}`)
}
