import type { RuleOperator } from '@/types'

// Deliberately decoupled from Prisma's generated types — this engine takes
// plain shapes so it stays a pure library with zero framework/DB awareness
// (see backend architecture doc, §02). Any caller (Simulator today, real
// eligibility evaluation later) adapts its own data into these shapes.

export interface EngineCondition {
  field: string
  operator: RuleOperator
  value: string
}

export interface EngineRule {
  name: string
  conditions: EngineCondition[]
  outcome: string
}

export type Facts = Record<string, string>

export interface RuleEvaluation {
  rule: string
  passed: boolean
  detail: string
}

export type EngineOutcome = 'eligible' | 'not_eligible' | 'eligible_with_conditions'

export interface EvaluationResult {
  outcome: EngineOutcome
  breakdown: RuleEvaluation[]
}
