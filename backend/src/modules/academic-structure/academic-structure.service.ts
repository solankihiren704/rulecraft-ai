import { ApiError } from '@/middleware/errorHandler'
import * as departmentsRepo from '@/modules/departments/departments.repository'
import * as programsRepo from '@/modules/programs/programs.repository'
import * as semestersRepo from '@/modules/semesters/semesters.repository'
import * as subjectsRepo from '@/modules/subjects/subjects.repository'
import type { RawImportRow } from './academic-structure.import'

/**
 * academic-structure.service.ts
 * Each row can describe as little as a bare department or as much as a
 * full department -> program -> semester -> subject path. Rows are
 * processed sequentially (not batched like students import) because a
 * later row can depend on a department/program/semester a *previous* row
 * in the same file just created — an in-memory cache avoids re-querying or
 * re-creating the same code/name twice within one import run.
 */

const MAX_IMPORT_ROWS = 1000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

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

function parsePositiveInt(value: string | undefined, min: number, max: number): number | null {
  if (value === undefined) return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) return null
  return n
}

interface Counts {
  departmentsCreated: number
  programsCreated: number
  semestersCreated: number
  subjectsCreated: number
}

interface Caches {
  departments: Map<string, string> // code -> id
  programs: Map<string, { id: string; departmentId: string }> // code -> {id, departmentId}
  semesters: Map<string, string> // `${programId}|${name}` -> id
}

async function resolveDepartment(values: Record<string, string>, caches: Caches, counts: Counts): Promise<{ id: string; summary: string }> {
  const code = values.departmentCode?.trim().toUpperCase()
  const name = values.departmentName?.trim()
  if (!code) throw new ApiError(400, 'Department code is required.')
  if (!name) throw new ApiError(400, 'Department name is required.')

  const cached = caches.departments.get(code)
  if (cached) return { id: cached, summary: `department "${code}"` }

  const existing = await departmentsRepo.findByCode(code)
  if (existing) {
    caches.departments.set(code, existing.id)
    return { id: existing.id, summary: `department "${code}" (existing)` }
  }
  const created = await departmentsRepo.create({ code, name })
  caches.departments.set(code, created.id)
  counts.departmentsCreated++
  return { id: created.id, summary: `department "${code}" (created)` }
}

async function resolveProgram(
  values: Record<string, string>,
  departmentId: string,
  caches: Caches,
  counts: Counts,
): Promise<{ id: string; summary: string } | null> {
  const code = values.programCode?.trim().toUpperCase()
  if (!code) return null

  const name = values.programName?.trim()
  const years = parsePositiveInt(values.programYears, 1, 6)
  if (!name) throw new ApiError(400, 'Program name is required when a program code is given.')
  if (years === null) throw new ApiError(400, 'Program years must be a whole number between 1 and 6.')

  const cached = caches.programs.get(code)
  if (cached) return { id: cached.id, summary: `program "${code}"` }

  const existing = await programsRepo.findByCode(code)
  if (existing) {
    if (existing.departmentId !== departmentId) {
      throw new ApiError(400, `Program "${code}" already exists under a different department.`)
    }
    caches.programs.set(code, { id: existing.id, departmentId })
    return { id: existing.id, summary: `program "${code}" (existing)` }
  }
  const created = await programsRepo.create({ code, name, departmentId, years })
  caches.programs.set(code, { id: created.id, departmentId })
  counts.programsCreated++
  return { id: created.id, summary: `program "${code}" (created)` }
}

async function resolveSemester(values: Record<string, string>, programId: string, caches: Caches, counts: Counts): Promise<{ id: string; summary: string } | null> {
  const name = values.semesterName?.trim()
  if (!name) return null

  const year = parsePositiveInt(values.semesterYear, 1, 6)
  const startDate = values.semesterStart?.trim()
  const endDate = values.semesterEnd?.trim()
  if (year === null) throw new ApiError(400, 'Semester year must be a whole number between 1 and 6.')
  if (!startDate || !DATE_RE.test(startDate)) throw new ApiError(400, 'Semester start date must be in YYYY-MM-DD format.')
  if (!endDate || !DATE_RE.test(endDate)) throw new ApiError(400, 'Semester end date must be in YYYY-MM-DD format.')
  if (endDate <= startDate) throw new ApiError(400, 'Semester end date must be after the start date.')

  const key = `${programId}|${name.toLowerCase()}`
  const cached = caches.semesters.get(key)
  if (cached) return { id: cached, summary: `semester "${name}"` }

  const existing = await semestersRepo.findByProgramAndName(programId, name)
  if (existing) {
    caches.semesters.set(key, existing.id)
    return { id: existing.id, summary: `semester "${name}" (existing)` }
  }
  const created = await semestersRepo.create({ name, programId, year, startDate, endDate })
  caches.semesters.set(key, created.id)
  counts.semestersCreated++
  return { id: created.id, summary: `semester "${name}" (created)` }
}

async function resolveSubject(values: Record<string, string>, semesterId: string, counts: Counts): Promise<string | null> {
  const code = values.subjectCode?.trim().toUpperCase()
  if (!code) return null

  const name = values.subjectName?.trim()
  const credits = parsePositiveInt(values.subjectCredits, 1, 10)
  if (!name) throw new ApiError(400, 'Subject name is required when a subject code is given.')
  if (credits === null) throw new ApiError(400, 'Subject credits must be a whole number between 1 and 10.')

  const existing = await subjectsRepo.findBySemesterAndCode(semesterId, code)
  if (existing) return `subject "${code}" (existing)`

  await subjectsRepo.create({ code, name, credits, semesterId })
  counts.subjectsCreated++
  return `subject "${code}" (created)`
}

async function processRow(values: Record<string, string>, caches: Caches, counts: Counts): Promise<string> {
  const parts: string[] = []

  const department = await resolveDepartment(values, caches, counts)
  parts.push(department.summary)

  const program = await resolveProgram(values, department.id, caches, counts)
  if (!program) return parts.join(', ')
  parts.push(program.summary)

  const semester = await resolveSemester(values, program.id, caches, counts)
  if (!semester) return parts.join(', ')
  parts.push(semester.summary)

  const subjectSummary = await resolveSubject(values, semester.id, counts)
  if (subjectSummary) parts.push(subjectSummary)

  return parts.join(', ')
}

export async function importHierarchy(rawRows: RawImportRow[]): Promise<ImportSummary> {
  if (rawRows.length === 0) {
    throw new ApiError(400, 'The file has no rows to import. Use the template and fill at least one row.')
  }
  if (rawRows.length > MAX_IMPORT_ROWS) {
    throw new ApiError(400, `A single import is limited to ${MAX_IMPORT_ROWS} rows — split large imports into multiple files.`)
  }

  const caches: Caches = { departments: new Map(), programs: new Map(), semesters: new Map() }
  const counts: Counts = { departmentsCreated: 0, programsCreated: 0, semestersCreated: 0, subjectsCreated: 0 }
  const results: ImportRowResult[] = []

  for (const { row, values } of rawRows) {
    try {
      const summary = await processRow(values, caches, counts)
      results.push({ row, status: 'success', summary })
    } catch (err) {
      results.push({ row, status: 'failed', summary: '', error: err instanceof ApiError ? err.message : 'Could not process this row.' })
    }
  }

  return {
    totalRows: rawRows.length,
    successCount: results.filter((r) => r.status === 'success').length,
    failedCount: results.filter((r) => r.status === 'failed').length,
    ...counts,
    results,
  }
}
