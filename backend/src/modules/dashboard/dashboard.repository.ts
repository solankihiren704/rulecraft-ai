import { Prisma } from '@prisma/client'
import { prisma } from '@/config/prisma'
import type { RegulationStatus } from '@prisma/client'

export interface OrgScope {
  // Present only for hod/faculty — every student/regulation/rule query is
  // filtered through the student's/regulation's program.departmentId chain.
  departmentId?: string
}

export function studentCounts(scope: OrgScope) {
  const where = scope.departmentId ? { program: { departmentId: scope.departmentId } } : {}
  return Promise.all([
    prisma.student.count({ where }),
    prisma.student.count({ where: { ...where, status: 'active' as const } }),
  ])
}

export async function studentsByDepartment(scope: OrgScope) {
  const where = scope.departmentId ? { program: { departmentId: scope.departmentId } } : {}
  const byProgram = await prisma.student.groupBy({ by: ['programId'], where, _count: { _all: true } })
  if (byProgram.length === 0) return []

  const programs = await prisma.program.findMany({
    where: { id: { in: byProgram.map((p) => p.programId) } },
    select: { id: true, departmentId: true, department: { select: { name: true } } },
  })
  const programToDept = new Map(programs.map((p) => [p.id, p.department.name]))

  const byDept = new Map<string, number>()
  for (const row of byProgram) {
    const deptName = programToDept.get(row.programId) ?? 'Unknown'
    byDept.set(deptName, (byDept.get(deptName) ?? 0) + row._count._all)
  }
  return [...byDept.entries()].map(([departmentName, count]) => ({ departmentName, count }))
}

export function regulationCountsByStatus(scope: OrgScope, visibleStatuses?: RegulationStatus[]) {
  const where = {
    ...(scope.departmentId ? { program: { departmentId: scope.departmentId } } : {}),
    ...(visibleStatuses ? { status: { in: visibleStatuses } } : {}),
  }
  return prisma.regulation.groupBy({ by: ['status'], where, _count: { _all: true } })
}

export function ruleCounts(scope: OrgScope, visibleRegulationStatuses?: RegulationStatus[]) {
  const where = {
    regulation: {
      ...(scope.departmentId ? { program: { departmentId: scope.departmentId } } : {}),
      ...(visibleRegulationStatuses ? { status: { in: visibleRegulationStatuses } } : {}),
    },
  }
  return Promise.all([
    prisma.rule.count({ where }),
    prisma.rule.count({ where: { ...where, active: true } }),
    prisma.rule.groupBy({ by: ['type'], where, _count: { _all: true } }),
  ])
}

export function simulationCounts(where: { ranById?: string }) {
  return Promise.all([
    prisma.simulationResult.count({ where }),
    prisma.simulationResult.groupBy({ by: ['outcome'], where, _count: { _all: true } }),
  ])
}

export function simulationsByDay(since: Date, ranById?: string) {
  const scopeCondition = ranById ? Prisma.sql`AND "ranById" = ${ranById}` : Prisma.empty
  return prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT date_trunc('day', "ranAt") AS day, COUNT(*)::bigint AS count
    FROM "SimulationResult"
    WHERE "ranAt" >= ${since} ${scopeCondition}
    GROUP BY day
    ORDER BY day ASC
  `
}

export function reportsGeneratedByUser(userId: string) {
  return prisma.report.count({ where: { generatedById: userId } })
}

export function recentApprovalSteps(visibleStatuses: RegulationStatus[] | undefined, take: number) {
  return prisma.approvalStep.findMany({
    where: visibleStatuses ? { regulation: { status: { in: visibleStatuses } } } : undefined,
    orderBy: { at: 'desc' },
    take,
    select: { step: true, at: true, note: true, by: { select: { name: true } }, regulation: { select: { name: true } } },
  })
}

export function recentRegulationVersions(visibleStatuses: RegulationStatus[] | undefined, take: number) {
  return prisma.regulationVersion.findMany({
    where: visibleStatuses ? { regulation: { status: { in: visibleStatuses } } } : undefined,
    orderBy: { changedAt: 'desc' },
    take,
    select: { version: true, changeSummary: true, changedAt: true, changedBy: { select: { name: true } }, regulation: { select: { name: true } } },
  })
}

export function recentSimulations(where: { ranById?: string }, take: number) {
  return prisma.simulationResult.findMany({
    where,
    orderBy: { ranAt: 'desc' },
    take,
    select: { studentName: true, outcome: true, ranAt: true, regulation: { select: { name: true } } },
  })
}
