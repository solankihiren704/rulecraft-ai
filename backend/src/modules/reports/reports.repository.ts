import { prisma } from '@/config/prisma'
import type { ReportFormat } from '@prisma/client'

export const summaryInclude = {
  program: { select: { name: true } },
  regulation: { select: { name: true } },
  generatedBy: { select: { name: true } },
}

export function listReports(generatedById: string) {
  return prisma.report.findMany({
    where: { generatedById },
    include: summaryInclude,
    orderBy: { generatedAt: 'desc' },
  })
}

export function findReportById(id: string) {
  return prisma.report.findUnique({ where: { id }, include: summaryInclude })
}

export function createReportRow(data: {
  reportType: string
  format: ReportFormat
  programId: string
  regulationId: string
  generatedById: string
  storageKey: string
}) {
  return prisma.report.create({ data, include: summaryInclude })
}

export function deleteReportRow(id: string) {
  return prisma.report.delete({ where: { id } })
}

// --- Source data the report content is built from ---

export function findRegulationForReport(regulationId: string) {
  return prisma.regulation.findUnique({
    where: { id: regulationId },
    include: {
      program: { select: { id: true, name: true, departmentId: true } },
      versions: { orderBy: { changedAt: 'desc' }, include: { changedBy: { select: { name: true } } } },
      approvalHistory: { orderBy: { at: 'asc' }, include: { by: { select: { name: true } } } },
    },
  })
}

export function ruleCountsByTypeAndActive(regulationId: string) {
  return prisma.rule.groupBy({
    by: ['type', 'active'],
    where: { regulationId },
    _count: { _all: true },
  })
}

export function ruleNamesByType(regulationId: string, types: string[]) {
  return prisma.rule
    .findMany({ where: { regulationId, type: { in: types as never[] } }, select: { name: true } })
    .then((rows) => rows.map((r) => r.name))
}

export function simulationOutcomeCounts(regulationId: string) {
  return prisma.simulationResult.groupBy({
    by: ['outcome'],
    where: { regulationId },
    _count: { _all: true },
  })
}

export function simulationRows(regulationId: string, take = 200) {
  return prisma.simulationResult.findMany({
    where: { regulationId },
    select: { studentName: true, outcome: true, ranAt: true },
    orderBy: { ranAt: 'desc' },
    take,
  })
}

export function breakdownOutcomeCounts(regulationId: string, ruleNames: string[]) {
  return prisma.simulationBreakdownItem.groupBy({
    by: ['passed'],
    where: { ruleName: { in: ruleNames }, simulationResult: { regulationId } },
    _count: { _all: true },
  })
}

export function breakdownRows(regulationId: string, ruleNames: string[], take = 200) {
  return prisma.simulationBreakdownItem.findMany({
    where: { ruleName: { in: ruleNames }, simulationResult: { regulationId } },
    select: {
      ruleName: true,
      passed: true,
      detail: true,
      simulationResult: { select: { studentName: true, ranAt: true } },
    },
    orderBy: { simulationResult: { ranAt: 'desc' } },
    take,
  })
}
