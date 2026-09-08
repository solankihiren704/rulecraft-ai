import type { BatchSimulationSummary } from '@/api/simulator'

/**
 * batchSummary.ts
 * Turns a BatchSimulationSummary into a plain-language recap. This is a
 * deterministic template over real numbers, not a live AI call — no
 * Gemini backend is wired up (same honest framing as AiAssistantBubble's
 * mockAiReply). It just saves someone from mentally reading a table of
 * counts.
 */
export function summarizeBatchResults(summary: BatchSimulationSummary, regulationName: string): string {
  const { totalStudents, succeeded, failed, outcomeCounts } = summary
  const pct = (n: number) => (succeeded > 0 ? Math.round((n / succeeded) * 100) : 0)

  const lines: string[] = []

  lines.push(
    `Batch simulation for "${regulationName}": ${succeeded} of ${totalStudents} student${totalStudents === 1 ? '' : 's'} evaluated` +
      (failed > 0 ? ` (${failed} could not be run — see the results table for why).` : '.'),
  )

  if (succeeded > 0) {
    lines.push(
      `${outcomeCounts.eligible} eligible (${pct(outcomeCounts.eligible)}%), ` +
        `${outcomeCounts.eligible_with_conditions} eligible with conditions (${pct(outcomeCounts.eligible_with_conditions)}%), ` +
        `${outcomeCounts.not_eligible} not eligible (${pct(outcomeCounts.not_eligible)}%).`,
    )
  }

  const failuresByRule = [...summary.ruleBreakdown].filter((r) => r.failed > 0).sort((a, b) => b.failed - a.failed)
  if (failuresByRule.length > 0) {
    const [top, ...rest] = failuresByRule
    lines.push(`The most common blocker is "${top.rule}", which ${top.failed} student${top.failed === 1 ? '' : 's'} did not satisfy.`)
    if (rest.length > 0) {
      const others = rest.slice(0, 3).map((r) => `"${r.rule}" (${r.failed})`).join(', ')
      lines.push(`Other rules with failures: ${others}.`)
    }
  } else if (succeeded > 0) {
    lines.push('Every active rule passed for every evaluated student.')
  }

  lines.push('This is a plain-language recap of the numbers above — the rule engine result is always the real authority, not this summary.')

  return lines.join(' ')
}
