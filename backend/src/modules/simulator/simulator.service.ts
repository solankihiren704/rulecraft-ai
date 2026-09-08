import { ApiError } from '@/middleware/errorHandler'
import { assertInScope } from '@/middleware/authorize'
import { evaluateRegulation } from '@/rule-engine/evaluate'
import type { EngineOutcome } from '@/rule-engine/types'
import type { ConditionNode, Role } from '@/types'
import * as repo from './simulator.repository'
import { toSimulationResult } from './simulator.mapper'
import type { BatchSimulationInput, RunSimulationInput } from './simulator.validators'

interface CurrentUser {
  id: string
  role: Role
  departmentId: string | null
}

async function resolveStudent(studentId: string | undefined, user: CurrentUser) {
  if (!studentId) {
    if (user.role === 'student') {
      throw new ApiError(400, 'Select your own student record to run a simulation.', { studentId: 'Required for students.' })
    }
    return null
  }

  const student = await repo.findStudentById(studentId)
  if (!student) throw new ApiError(404, 'Student not found')

  if (user.role === 'student') {
    // A student may only simulate their own eligibility, never another
    // student's — checked by matching the Student row's linked userId,
    // not just the id, since studentId and userId are different keys.
    if (student.userId !== user.id) {
      throw new ApiError(403, 'You can only run simulations for your own student record.')
    }
  } else {
    assertInScope(user, student.program.departmentId)
  }

  return student
}

export async function run(input: RunSimulationInput, user: CurrentUser) {
  const regulation = await repo.findRegulationWithActiveRules(input.regulationId)
  if (!regulation) throw new ApiError(404, 'Regulation not found')

  if (user.role === 'student' && regulation.status !== 'published') {
    throw new ApiError(404, 'Regulation not found')
  }

  const student = await resolveStudent(input.studentId, user)

  const engineRules = regulation.rules.map((rule) => ({
    name: rule.name,
    outcome: rule.outcome,
    conditionTree: rule.conditionTree as unknown as ConditionNode,
  }))

  const result = evaluateRegulation(engineRules, input.customValues)

  const created = await repo.create({
    studentId: student?.id ?? null,
    studentName: student?.name ?? 'Custom scenario',
    regulationId: input.regulationId,
    ranById: user.id,
    outcome: result.outcome,
    breakdown: result.breakdown.map((b) => ({ ruleName: b.rule, passed: b.passed, detail: b.detail })),
  })

  return toSimulationResult(created)
}

export async function history(filters: { regulationId?: string; studentId?: string }, user: CurrentUser) {
  const scoped = user.role === 'student' ? { ranById: user.id } : {}
  const rows = await repo.listHistory({ ...filters, ...scoped })
  return rows.map(toSimulationResult)
}

// --- Batch simulation ---------------------------------------------------
//
// Runs the same regulation + scenario inputs against many students in one
// call, persisting a real SimulationResult per student (so batch runs show
// up in history exactly like an individual run does) and returning
// aggregated pass/fail metrics on top. One bad student ID doesn't fail the
// whole batch — it's reported per-item, mirroring the student CSV import's
// best-effort/per-row-report design.

export interface BatchStudentOutcome {
  studentId: string
  studentName: string
  outcome: EngineOutcome | null
  error?: string
}

export interface BatchRuleTally {
  rule: string
  passed: number
  failed: number
}

export interface BatchSimulationSummary {
  regulationId: string
  totalStudents: number
  succeeded: number
  failed: number
  outcomeCounts: Record<EngineOutcome, number>
  ruleBreakdown: BatchRuleTally[]
  results: BatchStudentOutcome[]
}

export async function runBatch(input: BatchSimulationInput, user: CurrentUser): Promise<BatchSimulationSummary> {
  const regulation = await repo.findRegulationWithActiveRules(input.regulationId)
  if (!regulation) throw new ApiError(404, 'Regulation not found')

  if (user.role === 'student' && regulation.status !== 'published') {
    throw new ApiError(404, 'Regulation not found')
  }

  const engineRules = regulation.rules.map((rule) => ({
    name: rule.name,
    outcome: rule.outcome,
    conditionTree: rule.conditionTree as unknown as ConditionNode,
  }))

  const outcomeCounts: Record<EngineOutcome, number> = { eligible: 0, eligible_with_conditions: 0, not_eligible: 0 }
  const ruleTally = new Map<string, { passed: number; failed: number }>()
  const results: BatchStudentOutcome[] = []

  for (const studentId of input.studentIds) {
    try {
      const student = await resolveStudent(studentId, user)
      if (!student) throw new ApiError(404, 'Student not found')

      const evaluation = evaluateRegulation(engineRules, input.customValues)

      await repo.create({
        studentId: student.id,
        studentName: student.name,
        regulationId: input.regulationId,
        ranById: user.id,
        outcome: evaluation.outcome,
        breakdown: evaluation.breakdown.map((b) => ({ ruleName: b.rule, passed: b.passed, detail: b.detail })),
      })

      outcomeCounts[evaluation.outcome]++
      for (const b of evaluation.breakdown) {
        const tally = ruleTally.get(b.rule) ?? { passed: 0, failed: 0 }
        if (b.passed) tally.passed++
        else tally.failed++
        ruleTally.set(b.rule, tally)
      }

      results.push({ studentId: student.id, studentName: student.name, outcome: evaluation.outcome })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to run this student's simulation."
      results.push({ studentId, studentName: '', outcome: null, error: message })
    }
  }

  return {
    regulationId: input.regulationId,
    totalStudents: input.studentIds.length,
    succeeded: results.filter((r) => !r.error).length,
    failed: results.filter((r) => r.error).length,
    outcomeCounts,
    ruleBreakdown: [...ruleTally.entries()].map(([rule, t]) => ({ rule, passed: t.passed, failed: t.failed })),
    results,
  }
}
