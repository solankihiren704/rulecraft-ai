import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/config/prisma'
import { ApiError } from '@/middleware/errorHandler'
import type { Role } from '@/types'

export interface GradebookEntry {
  studentId: string
  studentCode: string
  studentName: string
  subjectCode: string
  subjectName: string
  internalMarks: number // max 30
  midSemMarks: number // max 20
  endSemMarks: number // max 50
  totalMarks: number // max 100
  grade: string
  gradePoints: number
  status: 'passed' | 'passed_with_grace' | 'failed'
  graceMarksApplied?: number
  updatedAt: string
  updatedBy: string
}

export interface SaveGradebookInput {
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

const DATA_DIR = path.resolve(process.cwd(), 'data')
const MARKS_FILE = path.join(DATA_DIR, 'gradebook_marks.json')

function ensureStorage(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!fs.existsSync(MARKS_FILE)) {
    fs.writeFileSync(MARKS_FILE, JSON.stringify({}, null, 2), 'utf-8')
  }
}

function readMarks(): Record<string, GradebookEntry> {
  ensureStorage()
  try {
    const raw = fs.readFileSync(MARKS_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeMarks(data: Record<string, GradebookEntry>): void {
  ensureStorage()
  fs.writeFileSync(MARKS_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

export function calculateGrade(marks: number): { grade: string; gradePoints: number } {
  if (marks >= 90) return { grade: 'O', gradePoints: 10 }
  if (marks >= 80) return { grade: 'A+', gradePoints: 9 }
  if (marks >= 70) return { grade: 'A', gradePoints: 8 }
  if (marks >= 60) return { grade: 'B+', gradePoints: 7 }
  if (marks >= 50) return { grade: 'B', gradePoints: 6 }
  if (marks >= 40) return { grade: 'C', gradePoints: 5 }
  return { grade: 'F', gradePoints: 0 }
}

/**
 * Key format: `${studentId}::${subjectCode}`
 */
function makeKey(studentId: string, subjectCode: string): string {
  return `${studentId}::${subjectCode.toUpperCase()}`
}

/**
 * Retrieve saved mark for a specific student and subject
 */
export function getStoredStudentSubjectMark(studentId: string, studentCode: string, subjectCode: string): GradebookEntry | null {
  const store = readMarks()
  const key1 = makeKey(studentId, subjectCode)
  if (store[key1]) return store[key1]
  if (studentCode) {
    const key2 = makeKey(studentCode, subjectCode)
    if (store[key2]) return store[key2]
  }
  return null
}

/**
 * Retrieve all saved marks for a student
 */
export function getAllStoredMarksForStudent(studentId: string, studentCode?: string): Record<string, GradebookEntry> {
  const store = readMarks()
  const result: Record<string, GradebookEntry> = {}
  for (const [, entry] of Object.entries(store)) {
    if (entry.studentId === studentId || (studentCode && entry.studentCode === studentCode)) {
      result[entry.subjectCode.toUpperCase()] = entry
    }
  }
  return result
}

const DEFAULT_CURRICULUM: Record<string, { code: string; name: string; credits: number }[]> = {
  CSE: [
    { code: 'CS101', name: 'Programming Fundamentals', credits: 4 },
    { code: 'CS102', name: 'Data Structures & Algorithms', credits: 4 },
    { code: 'CS201', name: 'Database Management Systems', credits: 4 },
    { code: 'CS202', name: 'Computer Networks', credits: 3 },
    { code: 'CS203', name: 'Operating Systems', credits: 4 },
  ],
  ECE: [
    { code: 'EC101', name: 'Digital Electronics', credits: 4 },
    { code: 'EC102', name: 'Signals & Systems', credits: 4 },
    { code: 'EC201', name: 'Microprocessors & Microcontrollers', credits: 4 },
    { code: 'EC202', name: 'Analog Integrated Circuits', credits: 3 },
  ],
  ME: [
    { code: 'ME101', name: 'Thermodynamics', credits: 4 },
    { code: 'ME102', name: 'Fluid Mechanics', credits: 4 },
    { code: 'ME201', name: 'Kinematics of Machinery', credits: 3 },
    { code: 'ME202', name: 'Manufacturing Processes', credits: 4 },
  ],
  CE: [
    { code: 'CE101', name: 'Structural Analysis', credits: 4 },
    { code: 'CE102', name: 'Surveying & Geomatics', credits: 3 },
    { code: 'CE201', name: 'Building Materials & Construction', credits: 4 },
    { code: 'CE202', name: 'Soil Mechanics', credits: 4 },
  ],
}

/**
 * Get gradebook matrix for a program, semester, and subject
 */
export async function getGradebookMatrix(
  params: {
    programId?: string
    semesterId?: string
    subjectCode?: string
  },
  user?: { id: string; role: Role; departmentId: string | null }
) {
  const isDeptScoped = user && (user.role === 'hod' || user.role === 'faculty') && user.departmentId

  // Security check: if HOD/Faculty manually requests a programId outside their department
  if (isDeptScoped && params.programId) {
    const requestedProgram = await prisma.program.findUnique({ where: { id: params.programId } })
    if (requestedProgram && requestedProgram.departmentId !== user.departmentId) {
      throw new ApiError(403, 'Access denied: You can only view gradebook records within your assigned department.')
    }
  }

  // Query subjects & programs (scoped to user's department for HOD/Faculty)
  const programs = await prisma.program.findMany({
    where: isDeptScoped ? { departmentId: user.departmentId! } : undefined,
    include: {
      department: true,
      semesters: {
        include: { subjects: true },
        orderBy: { year: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  // Prefer programs with existing semesters/subjects
  const selectedProgram = params.programId
    ? programs.find((p) => p.id === params.programId) || programs[0]
    : programs.find((p) => p.semesters.some((s) => s.subjects.length > 0)) || programs[0]

  if (!selectedProgram) {
    return {
      programs: [],
      semesters: [],
      subjects: [],
      selectedProgram: null,
      selectedSemester: null,
      selectedSubject: null,
      students: [],
    }
  }

  const deptCode = selectedProgram.department.code.toUpperCase()
  const fallbackList = DEFAULT_CURRICULUM[deptCode] ?? DEFAULT_CURRICULUM.CSE

  const activeSemesters = selectedProgram.semesters.length > 0
    ? selectedProgram.semesters
    : [{ id: 'sem-default-1', name: 'Semester 1', year: 1, subjects: fallbackList.map((f) => ({ id: `sub-${f.code}`, ...f, semesterId: 'sem-default-1', createdAt: new Date(), updatedAt: new Date() })) }]

  const selectedSemester = params.semesterId
    ? activeSemesters.find((s) => s.id === params.semesterId) || activeSemesters[0]
    : activeSemesters[0]

  const subjects = selectedSemester.subjects.length > 0
    ? selectedSemester.subjects
    : fallbackList.map((f) => ({ id: `sub-${f.code}`, ...f, semesterId: selectedSemester.id, createdAt: new Date(), updatedAt: new Date() }))

  const selectedSubject = params.subjectCode
    ? subjects.find((s) => s.code.toUpperCase() === params.subjectCode?.toUpperCase()) || subjects[0]
    : subjects[0]

  // Query enrolled students
  let students = await prisma.student.findMany({
    where: {
      programId: selectedProgram.id,
      year: selectedSemester.year,
    },
    orderBy: { studentId: 'asc' },
  })

  if (students.length === 0) {
    students = await prisma.student.findMany({
      where: { programId: selectedProgram.id },
      orderBy: { studentId: 'asc' },
    })
  }

  const storedMarks = readMarks()

  // Build matrix rows
  const matrixRows = students.map((stu) => {
    const subCode = selectedSubject?.code.toUpperCase() || 'CS101'
    const key = makeKey(stu.id, subCode)
    const keyByCode = makeKey(stu.studentId, subCode)
    const saved = storedMarks[key] || storedMarks[keyByCode]

    if (saved) {
      return {
        ...saved,
        studentId: stu.id,
        studentCode: stu.studentId,
        studentName: stu.name,
        email: stu.email,
        isCustomSaved: true,
      }
    }

    // Default baseline derived from GPA
    const gpaNorm = stu.gpa <= 4.0 ? (stu.gpa / 4.0) * 10.0 : stu.gpa
    const baseTotal = Math.min(96, Math.max(38, Math.round((gpaNorm / 10.0) * 88)))

    // Split roughly into 30% internal, 20% midsem, 50% endsem
    const internal = Math.min(30, Math.round((baseTotal * 0.3)))
    const midSem = Math.min(20, Math.round((baseTotal * 0.2)))
    const endSem = Math.max(0, baseTotal - internal - midSem)
    const total = internal + midSem + endSem

    let graceMarksApplied = 0
    let status: 'passed' | 'passed_with_grace' | 'failed' = 'passed'
    if (total >= 35 && total < 40) {
      graceMarksApplied = 40 - total
      status = 'passed_with_grace'
    } else if (total < 40) {
      status = 'failed'
    }

    const { grade, gradePoints } = calculateGrade(status === 'passed_with_grace' ? 40 : total)

    return {
      studentId: stu.id,
      studentCode: stu.studentId,
      studentName: stu.name,
      email: stu.email,
      subjectCode: subCode,
      subjectName: selectedSubject?.name || 'Subject',
      internalMarks: internal,
      midSemMarks: midSem,
      endSemMarks: endSem,
      totalMarks: status === 'passed_with_grace' ? 40 : total,
      grade,
      gradePoints,
      status,
      graceMarksApplied: graceMarksApplied > 0 ? graceMarksApplied : undefined,
      updatedAt: stu.updatedAt.toISOString(),
      updatedBy: 'System Baseline',
      isCustomSaved: false,
    }
  })

  return {
    programs: programs.map((p) => ({ id: p.id, name: p.name, code: p.code, department: p.department.name })),
    semesters: selectedProgram.semesters.map((s) => ({ id: s.id, name: s.name, year: s.year })),
    subjects: subjects.map((s) => ({ id: s.id, code: s.code, name: s.name, credits: s.credits })),
    selectedProgram: { id: selectedProgram.id, name: selectedProgram.name, code: selectedProgram.code },
    selectedSemester: selectedSemester ? { id: selectedSemester.id, name: selectedSemester.name, year: selectedSemester.year } : null,
    selectedSubject: selectedSubject ? { id: selectedSubject.id, code: selectedSubject.code, name: selectedSubject.name, credits: selectedSubject.credits } : null,
    students: matrixRows,
  }
}

/**
 * Save multiple student marks for a subject
 */
export async function saveGradebookEntries(
  input: SaveGradebookInput,
  user: { id: string; name?: string; role: Role; departmentId?: string | null }
) {
  if (user.role === 'student') {
    throw new ApiError(403, 'Students are not authorized to edit gradebook marks.')
  }

  const { subjectCode, subjectName = '', entries } = input
  if (!subjectCode) {
    throw new ApiError(400, 'Subject code is required.')
  }

  const store = readMarks()
  const updatedEntries: GradebookEntry[] = []

  // Load student records to verify and attach proper names
  const studentIds = entries.map((e) => e.studentId)
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    include: { program: true },
  })

  // Security check: if HOD or Faculty, ensure all students belong to their assigned department
  if ((user.role === 'hod' || user.role === 'faculty') && user.departmentId) {
    const invalid = students.find((s) => s.program.departmentId !== user.departmentId)
    if (invalid) {
      throw new ApiError(403, `Access denied: Student "${invalid.name}" (${invalid.studentId}) belongs to another department.`)
    }
  }

  const studentMap = new Map(students.map((s) => [s.id, s]))

  const updaterName = user.name || `${user.role.toUpperCase()} (${user.id.slice(0, 6)})`
  const now = new Date().toISOString()

  for (const item of entries) {
    const stu = studentMap.get(item.studentId)
    const stuCode = stu ? stu.studentId : item.studentId
    const stuName = stu ? stu.name : 'Student'

    // Validation
    const internal = Math.min(30, Math.max(0, Math.round(Number(item.internalMarks) || 0)))
    const midSem = Math.min(20, Math.max(0, Math.round(Number(item.midSemMarks) || 0)))
    const endSem = Math.min(50, Math.max(0, Math.round(Number(item.endSemMarks) || 0)))
    let rawTotal = internal + midSem + endSem

    let graceMarksApplied = item.graceMarksApplied || 0
    let status: 'passed' | 'passed_with_grace' | 'failed' = 'passed'

    if (rawTotal >= 35 && rawTotal < 40) {
      graceMarksApplied = 40 - rawTotal
      rawTotal = 40
      status = 'passed_with_grace'
    } else if (rawTotal < 40) {
      status = 'failed'
    }

    const { grade, gradePoints } = calculateGrade(rawTotal)

    const entry: GradebookEntry = {
      studentId: item.studentId,
      studentCode: stuCode,
      studentName: stuName,
      subjectCode: subjectCode.toUpperCase(),
      subjectName,
      internalMarks: internal,
      midSemMarks: midSem,
      endSemMarks: endSem,
      totalMarks: rawTotal,
      grade,
      gradePoints,
      status,
      graceMarksApplied: graceMarksApplied > 0 ? graceMarksApplied : undefined,
      updatedAt: now,
      updatedBy: updaterName,
    }

    // Save with primary student ID
    store[makeKey(item.studentId, subjectCode)] = entry
    // Also save by student roll code for quick lookups
    if (stuCode) {
      store[makeKey(stuCode, subjectCode)] = entry
    }

    updatedEntries.push(entry)
  }

  writeMarks(store)

  return {
    success: true,
    savedCount: updatedEntries.length,
    subjectCode: subjectCode.toUpperCase(),
    updatedAt: now,
    entries: updatedEntries,
  }
}
