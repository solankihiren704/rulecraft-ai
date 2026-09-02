import { describe, it, expect } from 'vitest'
import { evaluateCondition, evaluateRule, evaluateRegulation } from '../src/rule-engine/evaluate'
import type { EngineRule } from '../src/rule-engine/types'

describe('evaluateCondition', () => {
  it.each([
    ['gte', '80', '75', true],
    ['gte', '70', '75', false],
    ['lte', '4', '4', true],
    ['gt', '5', '5', false],
    ['lt', '4', '5', true],
    ['eq', '5.0', '5.0', true],
    ['neq', '3', '5', true],
  ] as const)('%s: %s vs %s -> %s', (operator, actual, expected, result) => {
    expect(evaluateCondition(operator, actual, expected)).toBe(result)
  })

  it('falls back to case-insensitive string comparison for non-numeric values', () => {
    expect(evaluateCondition('eq', 'true', 'TRUE')).toBe(true)
    expect(evaluateCondition('neq', 'true', 'false')).toBe(true)
  })

  it('treats unsupported operators on non-numeric values as not satisfied', () => {
    expect(evaluateCondition('gte', 'abc', 'def')).toBe(false)
  })
})

describe('evaluateRule', () => {
  const rule: EngineRule = {
    name: 'Minimum semester attendance',
    conditions: [{ field: 'attendancePercent', operator: 'gte', value: '75' }],
    outcome: 'Eligible to sit for semester exams',
  }

  it('passes when all conditions are satisfied', () => {
    const result = evaluateRule(rule, { attendancePercent: '90' })
    expect(result.passed).toBe(true)
    expect(result.detail).toBe(rule.outcome)
  })

  it('fails and explains which condition was not met', () => {
    const result = evaluateRule(rule, { attendancePercent: '60' })
    expect(result.passed).toBe(false)
    expect(result.detail).toContain('attendancePercent gte 75')
  })

  it('requires every condition to pass (AND semantics)', () => {
    const multi: EngineRule = {
      name: 'Condonation',
      conditions: [
        { field: 'attendancePercent', operator: 'gte', value: '65' },
        { field: 'medicalCertificate', operator: 'eq', value: 'true' },
      ],
      outcome: 'Condoned',
    }
    expect(evaluateRule(multi, { attendancePercent: '70', medicalCertificate: 'false' }).passed).toBe(false)
    expect(evaluateRule(multi, { attendancePercent: '70', medicalCertificate: 'true' }).passed).toBe(true)
  })
})

describe('evaluateRegulation', () => {
  const rules: EngineRule[] = [
    { name: 'Backlog limit', conditions: [{ field: 'activeBacklogs', operator: 'lte', value: '4' }], outcome: 'Promoted' },
    { name: 'CGPA threshold', conditions: [{ field: 'cgpa', operator: 'gte', value: '5.0' }], outcome: 'Eligible for promotion' },
  ]

  it('is eligible only when every rule passes', () => {
    const result = evaluateRegulation(rules, { activeBacklogs: '2', cgpa: '6.5' })
    expect(result.outcome).toBe('eligible')
    expect(result.breakdown).toHaveLength(2)
  })

  it('is not_eligible when every rule fails', () => {
    const result = evaluateRegulation(rules, { activeBacklogs: '9', cgpa: '2.0' })
    expect(result.outcome).toBe('not_eligible')
  })

  it('is eligible_with_conditions when some rules pass and some fail', () => {
    const result = evaluateRegulation(rules, { activeBacklogs: '2', cgpa: '2.0' })
    expect(result.outcome).toBe('eligible_with_conditions')
  })

  it('is eligible for a regulation with zero rules (vacuous truth)', () => {
    expect(evaluateRegulation([], {}).outcome).toBe('eligible')
  })
})
