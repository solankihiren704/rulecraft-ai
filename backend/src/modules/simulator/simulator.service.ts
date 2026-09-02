import { ApiError } from '@/middleware/errorHandler'
import { assertInScope } from '@/middleware/authorize'
import { evaluateRegulation } from '@/rule-engine/evaluate'
import type { Role } from '@/types'
import * as repo from './simulator.repository'
import { toSimulationResult } from './simulator.mapper'
import type { RunSimulationInput } from './simulator.validators'

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
    conditions: rule.conditions.map((c) => ({ field: c.field, operator: c.operator, value: c.value })),
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
