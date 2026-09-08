import { apiClient } from './client'

export interface ImportRowResult {
  row: number
  status: 'success' | 'failed'
  summary: string
  error?: string
}

export interface ImportSummary {
  totalRows: number
  successCount: number
  failedCount: number
  departmentsCreated: number
  programsCreated: number
  semestersCreated: number
  subjectsCreated: number
  results: ImportRowResult[]
}

export async function importTemplate(): Promise<{ blob: Blob; filename: string }> {
  const res = await apiClient.get<Blob>('/academic-structure/import/template', { responseType: 'blob' })
  const disposition = res.headers['content-disposition'] as string | undefined
  const match = disposition?.match(/filename="([^"]+)"/)
  return { blob: res.data, filename: match?.[1] ?? 'academic-structure-import-template.xlsx' }
}

export async function importHierarchy(file: File): Promise<ImportSummary> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiClient.post<{ success: true; data: ImportSummary }>('/academic-structure/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}
