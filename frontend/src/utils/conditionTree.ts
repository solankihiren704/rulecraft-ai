import type { ConditionNode } from '@/types'

export const operatorSymbols: Record<string, string> = {
  gte: '≥',
  lte: '≤',
  gt: '>',
  lt: '<',
  eq: '=',
  neq: '≠',
}

/** Renders a condition tree back to readable text, e.g. "(a >= 1 AND b <= 2) OR c = true". */
export function describeConditionTree(node: ConditionNode, depth = 0): string {
  if (node.type === 'condition') {
    return `${node.field} ${node.operator} ${node.value}`
  }
  const inner = node.children.map((child) => describeConditionTree(child, depth + 1)).join(` ${node.operator} `)
  return depth > 0 && node.children.length > 1 ? `(${inner})` : inner
}

/** Collects every distinct field name referenced anywhere in a condition tree. */
export function collectConditionFields(node: ConditionNode, into: Set<string> = new Set()): Set<string> {
  if (node.type === 'condition') {
    into.add(node.field)
  } else {
    node.children.forEach((child) => collectConditionFields(child, into))
  }
  return into
}
