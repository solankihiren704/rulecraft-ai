import type { Report as PrismaReport } from '@prisma/client'
import type { ReportSummary } from '@/types'

type ReportWithRelations = PrismaReport & {
  program: { name: string } | null
  regulation: { name: string } | null
  generatedBy: { name: string }
}

export function toReportSummary(row: ReportWithRelations): ReportSummary {
  return {
    id: row.id,
    reportType: row.reportType as ReportSummary['reportType'],
    format: row.format,
    programId: row.programId,
    programName: row.program?.name ?? null,
    regulationId: row.regulationId,
    regulationName: row.regulation?.name ?? null,
    generatedById: row.generatedById,
    generatedByName: row.generatedBy.name,
    generatedAt: row.generatedAt.toISOString(),
  }
}
