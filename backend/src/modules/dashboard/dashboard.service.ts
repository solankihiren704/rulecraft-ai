import type { RegulationStatus, Role } from '@prisma/client'
import * as repo from './dashboard.repository'
import type { DashboardActivityItem, DashboardSummary } from '@/types'

interface CurrentUser {
  id: string
  role: Role
  departmentId: string | null
}

// Mirrors the exact visibility rules already established (and tested) in
// regulations.service.ts / rules.service.ts / simulator.service.ts /
// reports.routes.ts — Dashboard never invents a stricter or looser rule of
// its own, only reuses each module's own definition of who can see what.
const STAFF_WITH_FULL_VISIBILITY: Role[] = ['super_admin', 'registrar', 'hod']
const REPORTS_ACCESS: Role[] = ['super_admin', 'registrar', 'hod']
const ACTIVITY_ITEMS_PER_SOURCE = 5
const CHART_WINDOW_DAYS = 30

function visibleRegulationStatuses(role: Role): RegulationStatus[] | undefined {
  return STAFF_WITH_FULL_VISIBILITY.includes(role) ? undefined : ['published']
}

function orgScope(user: CurrentUser): repo.OrgScope {
  if (user.role === 'hod' || user.role === 'faculty') {
    return { departmentId: user.departmentId ?? undefined }
  }
  return {}
}

function simulationScope(user: CurrentUser): { ranById?: string } {
  return user.role === 'student' ? { ranById: user.id } : {}
}

async function buildStudentsSummary(user: CurrentUser) {
  if (user.role === 'student') return null

  const scope = orgScope(user)
  const [[total, active], byDepartment] = await Promise.all([repo.studentCounts(scope), repo.studentsByDepartment(scope)])
  return { total, active, byDepartment }
}

async function buildRegulationsSummary(user: CurrentUser) {
  const rows = await repo.regulationCountsByStatus(orgScope(user), visibleRegulationStatuses(user.role))
  const total = rows.reduce((sum, r) => sum + r._count._all, 0)
  return { total, byStatus: rows.map((r) => ({ status: r.status, count: r._count._all })) }
}

async function buildRulesSummary(user: CurrentUser) {
  const [total, active, byType] = await repo.ruleCounts(orgScope(user), visibleRegulationStatuses(user.role))
  return { total, active, byType: byType.map((r) => ({ type: r.type, count: r._count._all })) }
}

async function buildSimulationsSummary(user: CurrentUser) {
  const scope = simulationScope(user)
  const since = new Date(Date.now() - CHART_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const [[total, byOutcome], byDayRaw] = await Promise.all([
    repo.simulationCounts(scope),
    repo.simulationsByDay(since, scope.ranById),
  ])
  return {
    total,
    byOutcome: byOutcome.map((r) => ({ outcome: r.outcome, count: r._count._all })),
    byDay: byDayRaw.map((r) => ({ date: r.day.toISOString().slice(0, 10), count: Number(r.count) })),
  }
}

async function buildReportsSummary(user: CurrentUser) {
  if (!REPORTS_ACCESS.includes(user.role)) return null
  return { totalGeneratedByMe: await repo.reportsGeneratedByUser(user.id) }
}

async function buildRecentActivity(user: CurrentUser): Promise<DashboardActivityItem[]> {
  const visible = visibleRegulationStatuses(user.role)
  const simScope = simulationScope(user)

  // A student's dashboard shows only their own simulation activity — the
  // regulation-lifecycle feed (approvals, new versions) is staff-facing
  // context about *how* a regulation came to be, not something scoped to
  // an individual student.
  const [approvalSteps, versions, simulations] = await Promise.all([
    user.role === 'student' ? [] : repo.recentApprovalSteps(visible, ACTIVITY_ITEMS_PER_SOURCE),
    user.role === 'student' ? [] : repo.recentRegulationVersions(visible, ACTIVITY_ITEMS_PER_SOURCE),
    repo.recentSimulations(simScope, ACTIVITY_ITEMS_PER_SOURCE),
  ])

  const items: DashboardActivityItem[] = [
    ...approvalSteps.map((s) => ({
      type: 'approval_step' as const,
      description: `${s.regulation.name}: ${s.step}${s.note ? ` — ${s.note}` : ''} (by ${s.by.name})`,
      at: s.at.toISOString(),
    })),
    ...versions.map((v) => ({
      type: 'regulation_version' as const,
      description: `${v.regulation.name} v${v.version} — ${v.changeSummary} (by ${v.changedBy.name})`,
      at: v.changedAt.toISOString(),
    })),
    ...simulations.map((s) => ({
      type: 'simulation' as const,
      description: `${s.studentName} — ${s.regulation.name}: ${s.outcome.replace(/_/g, ' ')}`,
      at: s.ranAt.toISOString(),
    })),
  ]

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, ACTIVITY_ITEMS_PER_SOURCE)
}

export async function getSummary(user: CurrentUser): Promise<DashboardSummary> {
  const [students, regulations, rules, simulations, reports, recentActivity] = await Promise.all([
    buildStudentsSummary(user),
    buildRegulationsSummary(user),
    buildRulesSummary(user),
    buildSimulationsSummary(user),
    buildReportsSummary(user),
    buildRecentActivity(user),
  ])

  return { students, regulations, rules, simulations, reports, recentActivity, generatedAt: new Date().toISOString() }
}
