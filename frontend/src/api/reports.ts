import { apiClient } from './client'
import type { ReportFormat, ReportSummary, ReportType } from '@/types'

export interface GenerateReportInput {
  reportType: ReportType
  programId: string
  regulationId: string
  format: ReportFormat
}

export async function generate(input: GenerateReportInput): Promise<ReportSummary> {
  const res = await apiClient.post<{ success: true; data: ReportSummary }>('/reports/generate', input)
  return res.data.data
}

export async function list(): Promise<ReportSummary[]> {
  const res = await apiClient.get<{ success: true; data: ReportSummary[] }>('/reports')
  return res.data.data
}

export async function remove(id: string): Promise<void> {
  await apiClient.delete(`/reports/${id}`)
}

export interface DownloadedFile {
  blob: Blob
  filename: string
}

export async function download(id: string, fallbackFilename: string): Promise<DownloadedFile> {
  const res = await apiClient.get<Blob>(`/reports/${id}/download`, { responseType: 'blob' })
  const disposition = res.headers['content-disposition'] as string | undefined
  const match = disposition?.match(/filename="([^"]+)"/)
  return { blob: res.data, filename: match?.[1] ?? fallbackFilename }
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
