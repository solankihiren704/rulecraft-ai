import type { RuleOperator } from '@/types'
import type { ConditionNode, EngineRule, EvaluationResult, Facts, RuleEvaluation } from './types'

/**
 * evaluate.ts
 * The deterministic rule engine. No HTTP, no Prisma, no side effects — a
 * rule's outcome is always a pure function of its conditions and the facts
 * given to it, which is what lets the Simulator preview a scenario and a
 * future real eligibility check produce identical results for identical
 * inputs. Mirrors (and replaces) the client-side evaluate() that used to
 * live directly in the frontend's SimulatorPage.
 */
export function evaluateCondition(operator: RuleOperator, actual: string, expected: string): boolean {
  const a = Number(actual)
  const e = Number(expected)

  if (!Number.isNaN(a) && !Number.isNaN(e)) {
    switch (operator) {
      case 'gte':
        return a >= e
      case 'lte':
        return a <= e
      case 'gt':
        return a > e
      case 'lt':
        return a < e
      case 'eq':
        return a === e
      case 'neq':
        return a !== e
    }
  }

  const normalizedActual = actual.trim().toLowerCase()
  const normalizedExpected = expected.trim().toLowerCase()
  switch (operator) {
    case 'eq':
      return normalizedActual === normalizedExpected
    case 'neq':
      return normalizedActual !== normalizedExpected
    default:
      return false
  }
}

/** Evaluates a condition tree (leaf or nested AND/OR group) against facts. */
export function evaluateNode(node: ConditionNode, facts: Facts): boolean {
  if (node.type === 'condition') {
    return evaluateCondition(node.operator, facts[node.field] ?? '', node.value)
  }
  const childResults = node.children.map((child) => evaluateNode(child, facts))
  return node.operator === 'AND' ? childResults.every(Boolean) : childResults.some(Boolean)
}

/** Renders a condition tree back to readable text, e.g. "(a >= 1 AND b <= 2) OR c = true". */
export function describeNode(node: ConditionNode, depth = 0): string {
  if (node.type === 'condition') {
    return `${node.field} ${node.operator} ${node.value}`
  }
  const inner = node.children.map((child) => describeNode(child, depth + 1)).join(` ${node.operator} `)
  return depth > 0 && node.children.length > 1 ? `(${inner})` : inner
}

export function evaluateRule(rule: EngineRule, facts: Facts): RuleEvaluation {
  const passed = evaluateNode(rule.conditionTree, facts)

  return {
    rule: rule.name,
    passed,
    detail: passed ? rule.outcome : `Did not satisfy: ${describeNode(rule.conditionTree)}`,
  }
}

export function evaluateRegulation(rules: EngineRule[], facts: Facts): EvaluationResult {
  const breakdown = rules.map((rule) => evaluateRule(rule, facts))

  const allPassed = breakdown.every((b) => b.passed)
  const anyPassed = breakdown.some((b) => b.passed)

  const outcome = allPassed ? 'eligible' : anyPassed ? 'eligible_with_conditions' : 'not_eligible'

  return { outcome, breakdown }
}
