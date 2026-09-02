import { ApiError } from '@/middleware/errorHandler'
import { assertInScope } from '@/middleware/authorize'
import { toDateOnly } from '@/utils/date'
import type { Role } from '@/types'
import * as repo from './reports.repository'
import * as storage from './storage'
import { renderCsv, renderExcel, renderPdf, type ReportPayload } from './reports.render'
import { toReportSummary } from './reports.mapper'
import type { GenerateReportInput } from './reports.validators'

interface CurrentUser {
  id: string
  name: string
  role: Role
  departmentId: string | null
}

const STAFF_WITH_FULL_VISIBILITY: Role[] = ['super_admin', 'registrar', 'hod']

const REPORT_TITLES: Record<GenerateReportInput['reportType'], string> = {
  'eligibility-summary': 'Eligibility Summary',
  'attendance-audit': 'Attendance Audit',
  'promotion-outcomes': 'Promotion Outcomes',
  'regulation-compliance': 'Regulation Compliance',
}

const FORMAT_EXTENSION: Record<GenerateReportInput['format'], string> = {
  csv: 'csv',
  pdf: 'pdf',
  excel: 'xlsx',
}

export const FORMAT_CONTENT_TYPE: Record<GenerateReportInput['format'], string> = {
  csv: 'text/csv',
  pdf: 'application/pdf',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

type RegulationForReport = NonNullable<Awaited<ReturnType<typeof repo.findRegulationForReport>>>

async function loadAndAuthorizeRegulation(input: GenerateReportInput, user: CurrentUser): Promise<RegulationForReport> {
  if (!STAFF_WITH_FULL_VISIBILITY.includes(user.role)) {
    throw new ApiError(403, 'You do not have permission to generate reports.')
  }

  const regulation = await repo.findRegulationForReport(input.regulationId)
  if (!regulation) throw new ApiError(404, 'Regulation not found')

  if (regulation.programId !== input.programId) {
    throw new ApiError(400, 'This regulation does not belong to the selected program.', {
      programId: 'Does not match the selected regulation.',
    })
  }

  if (user.role === 'hod') {
    assertInScope({ role: user.role, departmentId: user.departmentId }, regulation.program.departmentId)
  }

  return regulation
}

// --- Payload builders — one per report type, each sourced from real,
// traceable queries. Where a metric can't be reliably derived from existing
// data (see module-level note in reports.repository.ts), the payload's
// `notes` array says so explicitly instead of presenting a guess as fact.

async function buildEligibilitySummary(regulation: RegulationForReport): Promise<ReportPayload> {
  const [counts, rows] = await Promise.all([
    repo.simulationOutcomeCounts(regulation.id),
    repo.simulationRows(regulation.id),
  ])

  const byOutcome = Object.fromEntries(counts.map((c) => [c.outcome, c._count._all]))
  const total = counts.reduce((sum, c) => sum + c._count._all, 0)

  return {
    title: REPORT_TITLES['eligibility-summary'],
    subtitle: `${regulation.name} (${regulation.code}) · ${regulation.program.name}`,
    generatedAt: new Date(),
    generatedBy: '',
    notes: [],
    summary: [
      { label: 'Total simulations run', value: total },
      { label: 'Eligible', value: byOutcome.eligible ?? 0 },
      { label: 'Eligible with conditions', value: byOutcome.eligible_with_conditions ?? 0 },
      { label: 'Not eligible', value: byOutcome.not_eligible ?? 0 },
    ],
    tableTitle: total > rows.length ? `Simulation runs (most recent ${rows.length} of ${total})` : 'Simulation runs',
    tableColumns: ['Student', 'Outcome', 'Ran at'],
    tableRows: rows.map((r) => [r.studentName, r.outcome.replace(/_/g, ' '), r.ranAt.toLocaleString()]),
  }
}

async function buildRuleCategoryReport(
  regulation: RegulationForReport,
  reportType: 'attendance-audit' | 'promotion-outcomes',
  ruleTypes: string[],
  scopeLabel: string,
): Promise<ReportPayload> {
  const ruleNames = await repo.ruleNamesByType(regulation.id, ruleTypes)

  const notes = [
    `Scope: ${scopeLabel} rules currently defined on this regulation (${ruleNames.length} rule(s)). ` +
      'Matched to past simulation runs by rule name, so a rule that was renamed or removed after a simulation ran will not be counted here.',
    'This reflects recorded Rule Simulator runs, not a live tracking feed — this system does not record day-to-day attendance or promotion decisions outside the simulator.',
  ]

  if (ruleNames.length === 0) {
    return {
      title: REPORT_TITLES[reportType],
      subtitle: `${regulation.name} (${regulation.code}) · ${regulation.program.name}`,
      generatedAt: new Date(),
      generatedBy: '',
      notes: [`This regulation has no ${scopeLabel} rules defined, so there is nothing to report.`],
      summary: [{ label: 'Rules in scope', value: 0 }],
      tableTitle: 'Simulation evaluations',
      tableColumns: ['Student', 'Rule', 'Result', 'Detail', 'Ran at'],
      tableRows: [],
    }
  }

  const [counts, rows] = await Promise.all([
    repo.breakdownOutcomeCounts(regulation.id, ruleNames),
    repo.breakdownRows(regulation.id, ruleNames),
  ])

  const passed = counts.find((c) => c.passed === true)?._count._all ?? 0
  const failed = counts.find((c) => c.passed === false)?._count._all ?? 0

  return {
    title: REPORT_TITLES[reportType],
    subtitle: `${regulation.name} (${regulation.code}) · ${regulation.program.name}`,
    generatedAt: new Date(),
    generatedBy: '',
    notes,
    summary: [
      { label: 'Rules in scope', value: ruleNames.length },
      { label: 'Total evaluations', value: passed + failed },
      { label: 'Passed', value: passed },
      { label: 'Failed', value: failed },
    ],
    tableTitle: passed + failed > rows.length ? `Simulation evaluations (most recent ${rows.length})` : 'Simulation evaluations',
    tableColumns: ['Student', 'Rule', 'Result', 'Detail', 'Ran at'],
    tableRows: rows.map((r) => [r.simulationResult.studentName, r.ruleName, r.passed ? 'Passed' : 'Failed', r.detail, r.simulationResult.ranAt.toLocaleString()]),
  }
}

async function buildRegulationCompliance(regulation: RegulationForReport): Promise<ReportPayload> {
  const ruleCounts = await repo.ruleCountsByTypeAndActive(regulation.id)

  const byType = new Map<string, { active: number; inactive: number }>()
  for (const row of ruleCounts) {
    const entry = byType.get(row.type) ?? { active: 0, inactive: 0 }
    if (row.active) entry.active += row._count._all
    else entry.inactive += row._count._all
    byType.set(row.type, entry)
  }
  const totalRules = ruleCounts.reduce((sum, r) => sum + r._count._all, 0)
  const totalActive = [...byType.values()].reduce((sum, v) => sum + v.active, 0)

  const latestVersion = regulation.versions[0]
  const notes: string[] = []
  if (regulation.status !== 'published') {
    notes.push(`This regulation is currently "${regulation.status}", not published — it does not yet apply to real eligibility checks.`)
  }
  if (totalRules === 0) {
    notes.push('No rules are defined on this regulation yet.')
  }

  const summary: { label: string; value: string | number }[] = [
    { label: 'Status', value: regulation.status },
    { label: 'Current version', value: regulation.version },
    { label: 'Effective date', value: toDateOnly(regulation.effectiveDate) },
    { label: 'Last modified', value: toDateOnly(regulation.lastModified) },
    { label: 'Total rules', value: totalRules },
    { label: 'Active rules', value: totalActive },
    { label: 'Approval steps recorded', value: regulation.approvalHistory.length },
  ]
  for (const [type, counts] of byType.entries()) {
    summary.push({ label: `  ${type.replace(/_/g, ' ')} rules`, value: `${counts.active} active, ${counts.inactive} inactive` })
  }
  if (latestVersion) {
    summary.push({ label: 'Latest version note', value: latestVersion.changeSummary })
  }

  return {
    title: REPORT_TITLES['regulation-compliance'],
    subtitle: `${regulation.name} (${regulation.code}) · ${regulation.program.name}`,
    generatedAt: new Date(),
    generatedBy: '',
    notes,
    summary,
    tableTitle: 'Approval workflow history',
    tableColumns: ['Step', 'By', 'At', 'Note'],
    tableRows: regulation.approvalHistory.map((step) => [step.step, step.by.name, step.at.toLocaleString(), step.note ?? '']),
  }
}

async function buildPayload(input: GenerateReportInput, regulation: RegulationForReport): Promise<ReportPayload> {
  switch (input.reportType) {
    case 'eligibility-summary':
      return buildEligibilitySummary(regulation)
    case 'attendance-audit':
      return buildRuleCategoryReport(regulation, 'attendance-audit', ['attendance'], 'attendance')
    case 'promotion-outcomes':
      return buildRuleCategoryReport(regulation, 'promotion-outcomes', ['promotion', 'backlog'], 'promotion and backlog')
    case 'regulation-compliance':
      return buildRegulationCompliance(regulation)
  }
}

async function renderPayload(format: GenerateReportInput['format'], payload: ReportPayload): Promise<Buffer> {
  switch (format) {
    case 'csv':
      return renderCsv(payload)
    case 'excel':
      return renderExcel(payload)
    case 'pdf':
      return renderPdf(payload)
  }
}

export async function generate(input: GenerateReportInput, user: CurrentUser) {
  const regulation = await loadAndAuthorizeRegulation(input, user)
  const payload = await buildPayload(input, regulation)
  payload.generatedBy = user.name
  payload.generatedAt = new Date()

  const fileContent = await renderPayload(input.format, payload)
  const storageKey = await storage.saveReportFile(FORMAT_EXTENSION[input.format], fileContent)

  const row = await repo.createReportRow({
    reportType: input.reportType,
    format: input.format,
    programId: input.programId,
    regulationId: input.regulationId,
    generatedById: user.id,
    storageKey,
  })

  return toReportSummary(row)
}

export async function list(user: CurrentUser) {
  if (!STAFF_WITH_FULL_VISIBILITY.includes(user.role)) {
    throw new ApiError(403, 'You do not have permission to view reports.')
  }
  const rows = await repo.listReports(user.id)
  return rows.map(toReportSummary)
}

async function loadOwnedReport(id: string, user: CurrentUser) {
  const row = await repo.findReportById(id)
  if (!row) throw new ApiError(404, 'Report not found')
  if (row.generatedById !== user.id && user.role !== 'super_admin') {
    throw new ApiError(403, 'You can only access reports you generated.')
  }
  return row
}

export async function getFile(id: string, user: CurrentUser) {
  const row = await loadOwnedReport(id, user)
  const content = await storage.readReportFile(row.storageKey)
  const extension = FORMAT_EXTENSION[row.format]
  return { content, filename: `${row.reportType}-${row.id}.${extension}`, contentType: FORMAT_CONTENT_TYPE[row.format] }
}

export async function remove(id: string, user: CurrentUser) {
  const row = await loadOwnedReport(id, user)
  await storage.deleteReportFile(row.storageKey)
  await repo.deleteReportRow(id)
}
