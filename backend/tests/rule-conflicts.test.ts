import { describe, it, expect } from 'vitest'
import { findRuleConflicts } from '../src/rule-engine/conflicts'
import type { RuleForAnalysis } from '../src/rule-engine/conflicts'
import type { RuleOperator } from '../src/types'

function leaf(field: string, operator: RuleOperator, value: string) {
  return { type: 'condition' as const, field, operator, value }
}

describe('findRuleConflicts', () => {
  it('finds no conflicts across unrelated rules', () => {
    const rules: RuleForAnalysis[] = [
      { id: 'r1', name: 'Attendance', conditionTree: leaf('attendancePercent', 'gte', '75') },
      { id: 'r2', name: 'Backlog', conditionTree: leaf('activeBacklogs', 'lte', '4') },
    ]
    expect(findRuleConflicts(rules)).toEqual([])
  })

  it('finds no conflict when two rules constrain the same field compatibly', () => {
    const rules: RuleForAnalysis[] = [
      { id: 'r1', name: 'Min attendance', conditionTree: leaf('attendancePercent', 'gte', '75') },
      { id: 'r2', name: 'Max attendance sanity check', conditionTree: leaf('attendancePercent', 'lte', '100') },
    ]
    expect(findRuleConflicts(rules)).toEqual([])
  })

  it('detects incompatible numeric bounds across two rules (the documented example)', () => {
    const rules: RuleForAnalysis[] = [
      { id: 'r1', name: 'Rule A', conditionTree: leaf('attendancePercent', 'gte', '75') },
      { id: 'r2', name: 'Rule B', conditionTree: leaf('attendancePercent', 'lte', '70') },
    ]
    const conflicts = findRuleConflicts(rules)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].field).toBe('attendancePercent')
    expect(conflicts[0].ruleAId).toBe('r1')
    expect(conflicts[0].ruleBId).toBe('r2')
    expect(conflicts[0].description).toContain('Rule A')
    expect(conflicts[0].description).toContain('Rule B')
  })

  it('does not flag numeric bounds that still leave a satisfiable gap', () => {
    const rules: RuleForAnalysis[] = [
      { id: 'r1', name: 'Rule A', conditionTree: leaf('attendancePercent', 'gte', '70') },
      { id: 'r2', name: 'Rule B', conditionTree: leaf('attendancePercent', 'lte', '75') },
    ]
    // 70-75 is a non-empty overlap — compatible, no conflict.
    expect(findRuleConflicts(rules)).toEqual([])
  })

  it('detects a contradictory equality flag on the same field', () => {
    const rules: RuleForAnalysis[] = [
      { id: 'r1', name: 'Requires certificate', conditionTree: leaf('medicalCertificate', 'eq', 'true') },
      { id: 'r2', name: 'Rejects certificate', conditionTree: leaf('medicalCertificate', 'eq', 'false') },
    ]
    const conflicts = findRuleConflicts(rules)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].field).toBe('medicalCertificate')
  })

  it('detects an eq/neq contradiction on the same value', () => {
    const rules: RuleForAnalysis[] = [
      { id: 'r1', name: 'Requires status active', conditionTree: leaf('status', 'eq', 'active') },
      { id: 'r2', name: 'Rejects status active', conditionTree: leaf('status', 'neq', 'active') },
    ]
    expect(findRuleConflicts(rules)).toHaveLength(1)
  })

  it('flags a single rule whose own AND-clause is self-contradictory', () => {
    const rules: RuleForAnalysis[] = [
      {
        id: 'r1',
        name: 'Impossible rule',
        conditionTree: {
          type: 'group',
          operator: 'AND',
          children: [leaf('cgpa', 'gte', '8'), leaf('cgpa', 'lt', '5')],
        },
      },
    ]
    const conflicts = findRuleConflicts(rules)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].ruleAId).toBe('r1')
    expect(conflicts[0].ruleBId).toBe('r1')
    expect(conflicts[0].description).toContain('on its own')
  })

  it('does not flag an OR branch just because the other branch would conflict', () => {
    // (attendancePercent >= 75) OR (attendancePercent <= 70) is always
    // satisfiable by SOME value — no self-contradiction, since OR doesn't
    // require both branches to hold simultaneously.
    const rules: RuleForAnalysis[] = [
      {
        id: 'r1',
        name: 'Either extreme',
        conditionTree: {
          type: 'group',
          operator: 'OR',
          children: [leaf('attendancePercent', 'gte', '75'), leaf('attendancePercent', 'lte', '70')],
        },
      },
    ]
    expect(findRuleConflicts(rules)).toEqual([])
  })

  it('ignores different fields entirely', () => {
    const rules: RuleForAnalysis[] = [
      { id: 'r1', name: 'Rule A', conditionTree: leaf('attendancePercent', 'gte', '75') },
      { id: 'r2', name: 'Rule B', conditionTree: leaf('cgpa', 'lte', '2') },
    ]
    expect(findRuleConflicts(rules)).toEqual([])
  })

  it('is eligible (no conflicts) for zero or one rule', () => {
    expect(findRuleConflicts([])).toEqual([])
    expect(findRuleConflicts([{ id: 'r1', name: 'Solo', conditionTree: leaf('cgpa', 'gte', '5') }])).toEqual([])
  })
})
