import { describe, it, expect } from 'vitest'
import { evaluateCondition, evaluateRule, evaluateRegulation, describeNode } from '../src/rule-engine/evaluate'
import type { ConditionNode, EngineRule } from '../src/rule-engine/types'

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
    conditionTree: { type: 'condition', field: 'attendancePercent', operator: 'gte', value: '75' },
    outcome: 'Eligible to sit for semester exams',
  }

  it('passes when a single leaf condition is satisfied', () => {
    const result = evaluateRule(rule, { attendancePercent: '90' })
    expect(result.passed).toBe(true)
    expect(result.detail).toBe(rule.outcome)
  })

  it('fails and explains which condition was not met', () => {
    const result = evaluateRule(rule, { attendancePercent: '60' })
    expect(result.passed).toBe(false)
    expect(result.detail).toContain('attendancePercent gte 75')
  })

  it('requires every condition in an AND group to pass', () => {
    const multi: EngineRule = {
      name: 'Condonation',
      conditionTree: {
        type: 'group',
        operator: 'AND',
        children: [
          { type: 'condition', field: 'attendancePercent', operator: 'gte', value: '65' },
          { type: 'condition', field: 'medicalCertificate', operator: 'eq', value: 'true' },
        ],
      },
      outcome: 'Condoned',
    }
    expect(evaluateRule(multi, { attendancePercent: '70', medicalCertificate: 'false' }).passed).toBe(false)
    expect(evaluateRule(multi, { attendancePercent: '70', medicalCertificate: 'true' }).passed).toBe(true)
  })

  it('requires only one condition in an OR group to pass', () => {
    const either: EngineRule = {
      name: 'Alternate eligibility',
      conditionTree: {
        type: 'group',
        operator: 'OR',
        children: [
          { type: 'condition', field: 'cgpa', operator: 'gte', value: '8' },
          { type: 'condition', field: 'sportsQuota', operator: 'eq', value: 'true' },
        ],
      },
      outcome: 'Eligible',
    }
    expect(evaluateRule(either, { cgpa: '3', sportsQuota: 'false' }).passed).toBe(false)
    expect(evaluateRule(either, { cgpa: '3', sportsQuota: 'true' }).passed).toBe(true)
    expect(evaluateRule(either, { cgpa: '9', sportsQuota: 'false' }).passed).toBe(true)
  })

  it('evaluates arbitrarily nested AND/OR groups', () => {
    // (attendancePercent >= 65 AND medicalCertificate = true) OR (attendancePercent >= 70)
    const nested: EngineRule = {
      name: 'Attendance shortfall condonation',
      conditionTree: {
        type: 'group',
        operator: 'OR',
        children: [
          {
            type: 'group',
            operator: 'AND',
            children: [
              { type: 'condition', field: 'attendancePercent', operator: 'gte', value: '65' },
              { type: 'condition', field: 'medicalCertificate', operator: 'eq', value: 'true' },
            ],
          },
          { type: 'condition', field: 'attendancePercent', operator: 'gte', value: '70' },
        ],
      },
      outcome: 'Condoned to eligible with HOD approval',
    }
    // Below both thresholds, no certificate — fails both branches.
    expect(evaluateRule(nested, { attendancePercent: '60', medicalCertificate: 'false' }).passed).toBe(false)
    // Meets the medical branch (65-69% with a certificate).
    expect(evaluateRule(nested, { attendancePercent: '66', medicalCertificate: 'true' }).passed).toBe(true)
    // Clears the higher bar on attendance alone, no certificate needed.
    expect(evaluateRule(nested, { attendancePercent: '75', medicalCertificate: 'false' }).passed).toBe(true)
  })
})

describe('describeNode', () => {
  it('renders a leaf condition as plain text', () => {
    const node: ConditionNode = { type: 'condition', field: 'cgpa', operator: 'gte', value: '5.0' }
    expect(describeNode(node)).toBe('cgpa gte 5.0')
  })

  it('parenthesizes nested groups but not the top-level one', () => {
    const node: ConditionNode = {
      type: 'group',
      operator: 'OR',
      children: [
        {
          type: 'group',
          operator: 'AND',
          children: [
            { type: 'condition', field: 'attendancePercent', operator: 'gte', value: '65' },
            { type: 'condition', field: 'medicalCertificate', operator: 'eq', value: 'true' },
          ],
        },
        { type: 'condition', field: 'attendancePercent', operator: 'gte', value: '70' },
      ],
    }
    expect(describeNode(node)).toBe('(attendancePercent gte 65 AND medicalCertificate eq true) OR attendancePercent gte 70')
  })
})

describe('evaluateRegulation', () => {
  const rules: EngineRule[] = [
    { name: 'Backlog limit', conditionTree: { type: 'condition', field: 'activeBacklogs', operator: 'lte', value: '4' }, outcome: 'Promoted' },
    { name: 'CGPA threshold', conditionTree: { type: 'condition', field: 'cgpa', operator: 'gte', value: '5.0' }, outcome: 'Eligible for promotion' },
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
