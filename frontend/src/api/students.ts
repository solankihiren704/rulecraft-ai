import { apiClient } from './client'
import type { Student, StudentStatus } from '@/types'

export interface ListStudentsParams {
  search?: string
  programId?: string
  year?: number
  status?: StudentStatus
}

export interface ImportTemplateParams {
  departmentId?: string
  programId?: string
}

export interface ImportRowResult {
  row: number
  status: 'created' | 'failed'
  name?: string
  email?: string
  error?: string
}

export interface ImportSummary {
  totalRows: number
  createdCount: number
  failedCount: number
  results: ImportRowResult[]
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

export async function importTemplate(params?: ImportTemplateParams): Promise<{ blob: Blob; filename: string }> {
  const res = await apiClient.get<Blob>('/students/import/template', { params, responseType: 'blob' })
  const disposition = res.headers['content-disposition'] as string | undefined
  const match = disposition?.match(/filename="([^"]+)"/)
  return { blob: res.data, filename: match?.[1] ?? 'student-import-template.xlsx' }
}

export async function importStudents(file: File): Promise<ImportSummary> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiClient.post<{ success: true; data: ImportSummary }>('/students/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}
