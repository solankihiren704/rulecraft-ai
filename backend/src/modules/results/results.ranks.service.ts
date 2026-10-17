import { prisma } from '@/config/prisma'
import { computeStudentResult, type StudentResultData } from '@/modules/students/students.result'

export interface RankedStudent {
  rank: number
  percentile: number
  medal?: 'gold' | 'silver' | 'bronze'
  isDeansList: boolean
  isProbationWatch: boolean
  studentId: string // Roll number e.g. STU-CSE-001
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

export async function getUniversityRanks(filters: {
  programId?: string
  departmentId?: string
  year?: number
  search?: string
  filterType?: 'all' | 'deans_list' | 'probation'
}): Promise<RankListResponse> {
  const { programId, departmentId, year, search, filterType = 'all' } = filters

  // Fetch all matching students with program, department, semesters, regulations
  const students = await prisma.student.findMany({
    where: {
      programId: programId || undefined,
      year: year || undefined,
      program: departmentId ? { departmentId } : undefined,
      OR: search
        ? [
            { name: { contains: search, mode: 'insensitive' } },
            { studentId: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    },
    include: {
      program: {
        include: {
          department: true,
          semesters: {
            include: { subjects: true },
            orderBy: { year: 'asc' },
          },
          regulations: {
            where: { status: 'published' },
            include: { rules: { where: { active: true } } },
          },
        },
      },
    },
  })

  // Compute live academic performance for each student
  const computedList: { student: (typeof students)[0]; result: StudentResultData }[] = []
  for (const s of students) {
    const res = await computeStudentResult(s)
    computedList.push({ student: s, result: res })
  }

  // Sort: Active status first, then CGPA desc, SGPA desc, Percentage desc
  computedList.sort((a, b) => {
    if (b.result.academicSummary.cgpa !== a.result.academicSummary.cgpa) {
      return b.result.academicSummary.cgpa - a.result.academicSummary.cgpa
    }
    if (b.result.academicSummary.sgpa !== a.result.academicSummary.sgpa) {
      return b.result.academicSummary.sgpa - a.result.academicSummary.sgpa
    }
    return b.result.academicSummary.percentage - a.result.academicSummary.percentage
  })

  const totalCount = computedList.length

  const rankedStudents: RankedStudent[] = computedList.map((item, index) => {
    const rank = index + 1
    const percentile = totalCount > 0 ? Math.round(((totalCount - rank + 1) / totalCount) * 1000) / 10 : 100
    const failedSubjects = item.result.subjects.filter((s) => s.status === 'failed').length
    const isDeans = item.result.academicSummary.cgpa >= 8.5 && failedSubjects === 0 && item.student.status === 'active'
    const isProbation = item.result.academicSummary.cgpa < 5.0 || failedSubjects > 0 || item.student.status === 'suspended'

    let medal: 'gold' | 'silver' | 'bronze' | undefined
    if (rank === 1) medal = 'gold'
    else if (rank === 2) medal = 'silver'
    else if (rank === 3) medal = 'bronze'

    return {
      rank,
      percentile,
      medal,
      isDeansList: isDeans,
      isProbationWatch: isProbation,
      studentId: item.student.studentId,
      dbId: item.student.id,
      name: item.student.name,
      email: item.student.email,
      departmentName: item.student.program.department.name,
      departmentCode: item.student.program.department.code,
      programName: item.student.program.name,
      programCode: item.student.program.code,
      year: item.student.year,
      status: item.student.status,
      cgpa: item.result.academicSummary.cgpa,
      sgpa: item.result.academicSummary.sgpa,
      percentage: item.result.academicSummary.percentage,
      creditsEarned: item.result.academicSummary.creditsEarned,
      totalCredits: item.result.academicSummary.totalCredits,
      failedCount: failedSubjects,
      outcomeLabel: item.result.regulationVerdict.outcomeLabel,
    }
  })

  // Summary statistics
  const totalEvaluated = rankedStudents.length
  const cgpaValues = rankedStudents.map((s) => s.cgpa)
  const averageCgpa =
    totalEvaluated > 0
      ? Math.round((cgpaValues.reduce((a, b) => a + b, 0) / totalEvaluated) * 100) / 100
      : 0
  const highestCgpa = totalEvaluated > 0 ? Math.max(...cgpaValues) : 0
  const medianCgpa =
    totalEvaluated > 0
      ? cgpaValues[Math.floor(totalEvaluated / 2)]
      : 0

  const deansListCount = rankedStudents.filter((s) => s.isDeansList).length
  const probationCount = rankedStudents.filter((s) => s.isProbationWatch).length
  const passedStudents = rankedStudents.filter((s) => s.failedCount === 0 && s.status === 'active').length
  const passPercentage =
    totalEvaluated > 0 ? Math.round((passedStudents / totalEvaluated) * 1000) / 10 : 0

  const topThree = rankedStudents.slice(0, 3).map((s) => ({
    rank: s.rank,
    medal: s.medal!,
    name: s.name,
    studentId: s.studentId,
    cgpa: s.cgpa,
    percentage: s.percentage,
    programName: s.programName,
  }))

  // Apply tab filter if requested
  let filteredStudents = rankedStudents
  if (filterType === 'deans_list') {
    filteredStudents = rankedStudents.filter((s) => s.isDeansList)
  } else if (filterType === 'probation') {
    filteredStudents = rankedStudents.filter((s) => s.isProbationWatch)
  }

  // Get all programs for filter dropdown
  const allPrograms = await prisma.program.findMany({
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  })

  return {
    stats: {
      totalEvaluated,
      averageCgpa,
      highestCgpa,
      medianCgpa,
      passPercentage,
      deansListCount,
      probationCount,
      topThree,
    },
    students: filteredStudents,
    programs: allPrograms,
    years: [1, 2, 3, 4],
  }
}

/**
 * Generate CSV text for university rank list export
 */
export async function exportRanksCsv(filters: {
  programId?: string
  departmentId?: string
  year?: number
}): Promise<string> {
  const result = await getUniversityRanks(filters)

  const headers = [
    'Rank',
    'Student ID',
    'Full Name',
    'Department',
    'Program',
    'Academic Year',
    'CGPA',
    'SGPA',
    'Percentage (%)',
    'Credits Earned',
    'Backlogs',
    'Honor / Standing',
    'Status',
  ]

  const rows = result.students.map((s) => {
    let honors = 'Standard'
    if (s.medal === 'gold') honors = 'Gold Medalist (Rank 1)'
    else if (s.medal === 'silver') honors = 'Silver Medalist (Rank 2)'
    else if (s.medal === 'bronze') honors = 'Bronze Medalist (Rank 3)'
    else if (s.isDeansList) honors = "Dean's Honor Roll (Top 5%)"
    else if (s.isProbationWatch) honors = 'Academic Probation Watchlist'

    return [
      s.rank,
      `"${s.studentId}"`,
      `"${s.name}"`,
      `"${s.departmentName}"`,
      `"${s.programName}"`,
      `Year ${s.year}`,
      s.cgpa.toFixed(2),
      s.sgpa.toFixed(2),
      `${s.percentage.toFixed(1)}%`,
      `${s.creditsEarned}/${s.totalCredits}`,
      s.failedCount,
      `"${honors}"`,
      `"${s.status.toUpperCase()}"`,
    ].join(',')
  })

  return [headers.join(','), ...rows].join('\n')
}
