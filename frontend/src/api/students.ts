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

export interface AutoProvisionSummary {
  departments: string[]
  programs: string[]
  semestersCount: number
  subjectsCount: number
}

export interface ImportSummary {
  totalRows: number
  createdCount: number
  failedCount: number
  autoProvisioned?: AutoProvisionSummary
  results: ImportRowResult[]
  createdStudentIds?: string[]
}

export interface StudentInput {
  name: string
  email: string
  studentId: string
  programId: string
  year: number
  status: StudentStatus
  gpa: number
  attendance?: number
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

export async function importStudents(file: File, autoProvision = true): Promise<ImportSummary> {
  const form = new FormData()
  form.append('file', file)
  form.append('autoProvision', String(autoProvision))
  const res = await apiClient.post<{ success: true; data: ImportSummary }>('/students/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}

export type ExportFormat = 'csv' | 'pdf'

export async function exportSelected(studentIds: string[], format: ExportFormat): Promise<{ blob: Blob; filename: string }> {
  const res = await apiClient.post<Blob>('/students/export', { studentIds, format }, { responseType: 'blob' })
  const disposition = res.headers['content-disposition'] as string | undefined
  const match = disposition?.match(/filename="([^"]+)"/)
  return { blob: res.data, filename: match?.[1] ?? `students-export.${format}` }
}

export interface SubjectResult {
  code: string
  name: string
  credits: number
  maxMarks: number
  marksObtained: number
  grade: string
  gradePoints: number
  status: 'passed' | 'passed_with_grace' | 'failed'
  graceMarksApplied?: number
}

export interface VerificationData {
  token: string
  verificationUrl: string
  qrCodeDataUrl: string
  issuedAt: string
  issuer: string
  certificateNo: string
}

export type ResultWorkflowStatus = 'draft' | 'under_review' | 'approved' | 'published'

export interface WorkflowHistoryItem {
  id: string
  fromStatus: ResultWorkflowStatus
  toStatus: ResultWorkflowStatus
  action: 'submit' | 'approve' | 'publish' | 'revert'
  byUser: string
  byRole: string
  at: string
  notes?: string
}

export interface ResultWorkflowRecord {
  key: string
  programId: string
  semesterName: string
  status: ResultWorkflowStatus
  updatedAt: string
  updatedBy: string
  updatedByRole: string
  notes?: string
  history: WorkflowHistoryItem[]
}

export interface StudentResultData {
  student: {
    id: string
    name: string
    studentId: string
    email: string
    programName: string
    programCode: string
    departmentName: string
    year: number
    semesterName: string
    status: string
    enrollDate: string
    attendance?: number
  }
  academicSummary: {
    totalMarksObtained: number
    maxTotalMarks: number
    percentage: number
    sgpa: number
    cgpa: number
    totalCredits: number
    creditsEarned: number
  }
  subjects: SubjectResult[]
  regulationVerdict: {
    regulationName: string
    regulationCode: string
    outcome: 'promoted' | 'promoted_with_atkt' | 'distinction' | 'detained'
    outcomeLabel: string
    ruleEvaluations: {
      ruleName: string
      ruleType: string
      passed: boolean
      detail: string
    }[]
  }
  verification: VerificationData
  publicationStatus: ResultWorkflowStatus
  generatedAt: string
}

export async function getResult(id: string): Promise<StudentResultData> {
  const res = await apiClient.get<{ success: true; data: StudentResultData }>(`/students/${id}/result`)
  return res.data.data
}

export async function downloadResultPdf(id: string): Promise<{ blob: Blob; filename: string }> {
  const res = await apiClient.get<Blob>(`/students/${id}/result/pdf`, { responseType: 'blob' })
  const disposition = res.headers['content-disposition'] as string | undefined
  const match = disposition?.match(/filename="([^"]+)"/)
  return { blob: res.data, filename: match?.[1] ?? `marksheet-${id}.pdf` }
}

export interface PublicVerificationResponse {
  verified: boolean
  verifiedAt: string
  institution: string
  issuingOffice: string
  token: string
  certificateNo: string
  student: StudentResultData['student']
  academicSummary: StudentResultData['academicSummary']
  subjects: SubjectResult[]
  regulationVerdict: StudentResultData['regulationVerdict']
  publicationStatus: ResultWorkflowStatus
  qrCodeDataUrl: string
}

export async function getPublicVerification(token: string): Promise<PublicVerificationResponse> {
  const res = await apiClient.get<{ success: true; data: PublicVerificationResponse }>(`/public/verify/${token}`)
  return res.data.data
}

export async function downloadPublicVerificationPdf(token: string): Promise<{ blob: Blob; filename: string }> {
  const res = await apiClient.get<Blob>(`/public/verify/${token}/pdf`, { responseType: 'blob' })
  const disposition = res.headers['content-disposition'] as string | undefined
  const match = disposition?.match(/filename="([^"]+)"/)
  return { blob: res.data, filename: match?.[1] ?? `verified-marksheet-${token}.pdf` }
}

export async function getWorkflowStatus(programId = 'all'): Promise<ResultWorkflowRecord> {
  const res = await apiClient.get<{ success: true; data: ResultWorkflowRecord }>('/results/workflow/status', {
    params: { programId },
  })
  return res.data.data
}

export async function transitionWorkflow(input: {
  programId?: string
  action: 'submit' | 'approve' | 'publish' | 'revert'
  notes?: string
}): Promise<ResultWorkflowRecord> {
  const res = await apiClient.post<{ success: true; data: ResultWorkflowRecord }>('/results/workflow/transition', input)
  return res.data.data
}

export interface ExportCredentialsOptions {
  departmentId?: string
  programId?: string
  studentIds?: string[]
}

export async function exportCredentials(options: ExportCredentialsOptions = {}): Promise<{ blob: Blob; filename: string }> {
  const res = await apiClient.post<Blob>('/students/export-credentials', options, { responseType: 'blob' })
  const disposition = res.headers['content-disposition'] as string | undefined
  const match = disposition?.match(/filename="([^"]+)"/)
  return { blob: res.data, filename: match?.[1] ?? `student-credentials-${new Date().toISOString().slice(0, 10)}.xlsx` }
}

export async function resetPassword(studentId: string): Promise<{ message: string; tempPassword: string }> {
  const res = await apiClient.post<{ success: true; data: { message: string; tempPassword: string } }>(
    `/students/${studentId}/reset-password`,
  )
  return res.data.data
}

