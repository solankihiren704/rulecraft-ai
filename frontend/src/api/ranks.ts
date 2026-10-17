import { apiClient } from './client'

export interface RankedStudent {
  rank: number
  percentile: number
  medal?: 'gold' | 'silver' | 'bronze'
  isDeansList: boolean
  isProbationWatch: boolean
  studentId: string
  dbId: string
  name: string
  email: string
  departmentName: string
  departmentCode: string
  programName: string
  programCode: string
  year: number
  status: string
  cgpa: number
  sgpa: number
  percentage: number
  creditsEarned: number
  totalCredits: number
  failedCount: number
  outcomeLabel: string
}

export interface RankListStats {
  totalEvaluated: number
  averageCgpa: number
  highestCgpa: number
  medianCgpa: number
  passPercentage: number
  deansListCount: number
  probationCount: number
  topThree: {
    rank: number
    medal: 'gold' | 'silver' | 'bronze'
    name: string
    studentId: string
    cgpa: number
    percentage: number
    programName: string
  }[]
}

export interface RankListResponse {
  stats: RankListStats
  students: RankedStudent[]
  programs: { id: string; name: string; code: string }[]
  years: number[]
}

export async function getUniversityRanks(params?: {
  programId?: string
  departmentId?: string
  year?: number
  search?: string
  filterType?: 'all' | 'deans_list' | 'probation'
}): Promise<RankListResponse> {
  const res = await apiClient.get<{ success: true; data: RankListResponse }>('/results/ranks', {
    params,
  })
  return res.data.data
}

export async function exportRanksCsv(params?: {
  programId?: string
  departmentId?: string
  year?: number
}): Promise<{ blob: Blob; filename: string }> {
  const res = await apiClient.get<Blob>('/results/ranks/export', {
    params,
    responseType: 'blob',
  })
  return {
    blob: res.data,
    filename: `university-rankings-${new Date().toISOString().slice(0, 10)}.csv`,
  }
}
