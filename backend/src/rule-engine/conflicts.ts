import type { RuleOperator } from '@/types'
import type { ConditionNode, LeafCondition } from './types'

/**
 * conflicts.ts
 * A heuristic conflict analyzer for a regulation's active rules — NOT a
 * general SAT solver. Proving two arbitrary nested AND/OR boolean trees can
 * never both be satisfied is undecidable in general; what this catches is
 * the practical, common case: two conditions on the *same field*, required
 * together (in an AND relationship, whether within one rule or across two
 * rules that must both pass), that no single value can satisfy —
 * incompatible numeric bounds (attendance gte 75 AND lte 70) or
 * conflicting equality checks (field eq "true" AND eq "false", or eq "x"
 * AND neq "x"). It says nothing about conflicts it doesn't recognize; the
 * API/UI layer is expected to present this as "issues found", never as
 * "no issues" being a guarantee of correctness.
 */

export interface RuleForAnalysis {
  id: string
  name: string
  conditionTree: ConditionNode
}

export interface RuleConflict {
  ruleAId: string
  ruleAName: string
  ruleBId: string
  ruleBName: string
  field: string
  description: string
}

const OPERATOR_WORDS: Record<RuleOperator, string> = {
  gte: 'at least',
  gt: 'more than',
  lte: 'at most',
  lt: 'less than',
  eq: 'exactly',
  neq: 'not equal to',
}

function describeCondition(c: LeafCondition): string {
  return `${c.field} ${OPERATOR_WORDS[c.operator]} ${c.value}`
}

// A DNF clause is a list of leaf conditions that must ALL hold for that
// "path" through the tree to satisfy the rule. A rule's full DNF is the OR
// of its clauses. Bounded defensively — realistic rules have a handful of
// conditions, but a pathological deeply-nested tree could blow this up
// combinatorially, so clause count is capped rather than left to hang.
const MAX_CLAUSES = 64

function toDnf(node: ConditionNode): LeafCondition[][] {
  if (node.type === 'condition') return [[node]]

  if (node.operator === 'AND') {
    return node.children.reduce<LeafCondition[][]>(
      (clauses, child) => {
        const childClauses = toDnf(child)
        const combined: LeafCondition[][] = []
        for (const existing of clauses) {
          for (const addition of childClauses) {
            combined.push([...existing, ...addition])
            if (combined.length >= MAX_CLAUSES) return combined
          }
        }
        return combined
      },
      [[]],
    )
  }

  // OR
  return node.children.flatMap(toDnf).slice(0, MAX_CLAUSES)
}

interface Interval {
  min: number
  minInclusive: boolean
  max: number
  maxInclusive: boolean
}

function toInterval(operator: RuleOperator, value: number): Interval | null {
  switch (operator) {
    case 'gte':
      return { min: value, minInclusive: true, max: Infinity, maxInclusive: true }
    case 'gt':
      return { min: value, minInclusive: false, max: Infinity, maxInclusive: true }
    case 'lte':
      return { min: -Infinity, minInclusive: true, max: value, maxInclusive: true }
    case 'lt':
      return { min: -Infinity, minInclusive: true, max: value, maxInclusive: false }
    case 'eq':
      return { min: value, minInclusive: true, max: value, maxInclusive: true }
    default:
      // neq isn't representable as a single interval — handled separately.
      return null
  }
}

function endBefore(end: number, endInclusive: boolean, start: number, startInclusive: boolean): boolean {
  if (end < start) return true
  if (end > start) return false
  return !(endInclusive && startInclusive)
}

function intervalsOverlap(a: Interval, b: Interval): boolean {
  if (endBefore(a.max, a.maxInclusive, b.min, b.minInclusive)) return false
  if (endBefore(b.max, b.maxInclusive, a.min, a.minInclusive)) return false
  return true
}

// Returns a noun-phrase (deliberately no leading conjugated verb — callers
// embed this after both singular ("it requires...") and plural ("they
// require...") wrapper sentences, so the phrase itself must stay verb-free).
function checkPair(a: LeafCondition, b: LeafCondition): string | null {
  const aNum = Number(a.value)
  const bNum = Number(b.value)
  const bothNumeric = !Number.isNaN(aNum) && !Number.isNaN(bNum)

  if (a.operator === 'eq' && b.operator === 'eq') {
    const same = bothNumeric ? aNum === bNum : a.value.trim().toLowerCase() === b.value.trim().toLowerCase()
    if (same) return null
    return `${describeCondition(a)} and ${describeCondition(b)} — a field can't equal two different values at once`
  }

  if ((a.operator === 'eq' && b.operator === 'neq') || (a.operator === 'neq' && b.operator === 'eq')) {
    const eqCond = a.operator === 'eq' ? a : b
    const neqCond = a.operator === 'eq' ? b : a
    const same = bothNumeric ? aNum === bNum : eqCond.value.trim().toLowerCase() === neqCond.value.trim().toLowerCase()
    if (!same) return null
    return `${describeCondition(eqCond)} and ${describeCondition(neqCond)}`
  }

  if (bothNumeric) {
    const intervalA = toInterval(a.operator, aNum)
    const intervalB = toInterval(b.operator, bNum)
    if (intervalA && intervalB && !intervalsOverlap(intervalA, intervalB)) {
      return `${describeCondition(a)} together with ${describeCondition(b)} — no single value satisfies both`
    }
  }

  return null
}

function checkClausePair(clauseA: LeafCondition[], clauseB: LeafCondition[]): { field: string; reason: string }[] {
  const found: { field: string; reason: string }[] = []
  for (const a of clauseA) {
    for (const b of clauseB) {
      if (a.field !== b.field) continue
      const reason = checkPair(a, b)
      if (reason) found.push({ field: a.field, reason })
    }
  }
  return found
}

// Triangular (i < j only) so each unordered pair within one clause is
// checked exactly once — checkClausePair(clause, clause) would visit both
// (a,b) and (b,a), which checkPair's asymmetric wording turns into two
// differently-worded (and so non-deduped) findings for the same conflict.
function checkConditionList(conditions: LeafCondition[]): { field: string; reason: string }[] {
  const found: { field: string; reason: string }[] = []
  for (let i = 0; i < conditions.length; i++) {
    for (let j = i + 1; j < conditions.length; j++) {
      const a = conditions[i]
      const b = conditions[j]
      if (a.field !== b.field) continue
      const reason = checkPair(a, b)
      if (reason) found.push({ field: a.field, reason })
    }
  }
  return found
}

/**
 * Analyzes a regulation's active rules for same-field contradictions.
 * Two kinds of findings:
 *  - a single rule whose own conditions can never all be true at once
 *    (ruleA === ruleB in the result)
 *  - two different rules with a branch that can never both be true, which
 *    matters because a regulation requires every active rule to pass
 *    simultaneously for an "eligible" outcome
 */
export function findRuleConflicts(rules: RuleForAnalysis[]): RuleConflict[] {
  const withClauses = rules.map((r) => ({ id: r.id, name: r.name, clauses: toDnf(r.conditionTree) }))
  const results: RuleConflict[] = []
  const seen = new Set<string>()

  function record(a: { id: string; name: string }, b: { id: string; name: string }, field: string, description: string) {
    const key = [a.id, b.id, field, description].join('|')
    if (seen.has(key)) return
    seen.add(key)
    results.push({ ruleAId: a.id, ruleAName: a.name, ruleBId: b.id, ruleBName: b.name, field, description })
  }

  for (const rule of withClauses) {
    for (const clause of rule.clauses) {
      for (const { field, reason } of checkConditionList(clause)) {
        record(rule, rule, field, `"${rule.name}" can never be satisfied on its own — it requires ${reason}.`)
      }
    }
  }

  for (let i = 0; i < withClauses.length; i++) {
    for (let j = i + 1; j < withClauses.length; j++) {
      const ruleA = withClauses[i]
      const ruleB = withClauses[j]
      for (const clauseA of ruleA.clauses) {
        for (const clauseB of ruleB.clauses) {
          for (const { field, reason } of checkClausePair(clauseA, clauseB)) {
            record(ruleA, ruleB, field, `"${ruleA.name}" and "${ruleB.name}" can never both pass — together they require ${reason}.`)
          }
        }
      }
    }
  }

  return results
}
