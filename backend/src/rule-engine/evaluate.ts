import type { RuleOperator } from '@/types'
import type { EngineCondition, EngineRule, EvaluationResult, Facts, RuleEvaluation } from './types'

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

function formatCondition(condition: EngineCondition): string {
  return `${condition.field} ${condition.operator} ${condition.value}`
}

export function evaluateRule(rule: EngineRule, facts: Facts): RuleEvaluation {
  const passed = rule.conditions.every((condition) =>
    evaluateCondition(condition.operator, facts[condition.field] ?? '', condition.value),
  )

  return {
    rule: rule.name,
    passed,
    detail: passed ? rule.outcome : `Did not satisfy: ${rule.conditions.map(formatCondition).join(', ')}`,
  }
}

export function evaluateRegulation(rules: EngineRule[], facts: Facts): EvaluationResult {
  const breakdown = rules.map((rule) => evaluateRule(rule, facts))

  const allPassed = breakdown.every((b) => b.passed)
  const anyPassed = breakdown.some((b) => b.passed)

  const outcome = allPassed ? 'eligible' : anyPassed ? 'eligible_with_conditions' : 'not_eligible'

  return { outcome, breakdown }
}
