import type { RuleOperator } from '@/types'

// Deliberately decoupled from Prisma's generated types — this engine takes
// plain shapes so it stays a pure library with zero framework/DB awareness
// (see backend architecture doc, §02). Any caller (Simulator today, real
// eligibility evaluation later) adapts its own data into these shapes.

export interface LeafCondition {
  type: 'condition'
  field: string
  operator: RuleOperator
  value: string
}

export interface ConditionGroup {
  type: 'group'
  operator: 'AND' | 'OR'
  children: ConditionNode[]
}

/// A rule's condition tree: either one leaf condition (no group wrapper
/// needed for the common single-condition case) or a group of children
/// combined with AND/OR, where each child can itself be a leaf or another
/// nested group — arbitrary nesting, e.g. (A AND B) OR (C AND (D OR E)).
export type ConditionNode = LeafCondition | ConditionGroup

export interface EngineRule {
  name: string
  conditionTree: ConditionNode
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
