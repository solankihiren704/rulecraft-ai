import { apiClient } from './client'
import type { ResultWorkflowRecord } from './students'

export interface GradebookStudentRow {
  studentId: string
  studentCode: string
  studentName: string
  email: string
  subjectCode: string
  subjectName: string
  internalMarks: number
  midSemMarks: number
  endSemMarks: number
  totalMarks: number
  grade: string
  gradePoints: number
  status: 'passed' | 'passed_with_grace' | 'failed'
  graceMarksApplied?: number
  updatedAt: string
  updatedBy: string
  isCustomSaved: boolean
}

export interface GradebookMatrixResponse {
  programs: { id: string; name: string; code: string; department: string }[]
  semesters: { id: string; name: string; year: number }[]
  subjects: { id: string; code: string; name: string; credits: number }[]
  selectedProgram: { id: string; name: string; code: string } | null
  selectedSemester: { id: string; name: string; year: number } | null
  selectedSubject: { id: string; code: string; name: string; credits: number } | null
  students: GradebookStudentRow[]
}

export interface SaveGradebookPayload {
  programId?: string
  semesterId?: string
  subjectCode: string
  subjectName?: string
  entries: {
    studentId: string
    internalMarks: number
    midSemMarks: number
    endSemMarks: number
    graceMarksApplied?: number
  }[]
  submitForModeration?: boolean
}

export interface SaveGradebookResponse {
  success: true
  savedCount: number
  subjectCode: string
  updatedAt: string
  workflow?: ResultWorkflowRecord | null
}

export async function getGradebookMatrix(params?: {
  programId?: string
  semesterId?: string
  subjectCode?: string
}): Promise<GradebookMatrixResponse> {
  const res = await apiClient.get<{ success: true; data: GradebookMatrixResponse }>('/results/gradebook', {
    params,
  })
  return res.data.data
}

export async function saveGradebookMatrix(
  payload: SaveGradebookPayload
): Promise<SaveGradebookResponse> {
  const res = await apiClient.post<{ success: true; data: SaveGradebookResponse }>(
    '/results/gradebook/save',
    payload
  )
  return res.data.data
}
