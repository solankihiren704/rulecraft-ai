import { z } from 'zod'

export const reportTypeEnum = z.enum([
  'eligibility-summary',
  'attendance-audit',
  'promotion-outcomes',
  'regulation-compliance',
])

export const reportFormatEnum = z.enum(['csv', 'pdf', 'excel'])

export const generateReportSchema = z.object({
  reportType: reportTypeEnum,
  programId: z.string().uuid('Select a program.'),
  regulationId: z.string().uuid('Select a regulation.'),
  format: reportFormatEnum,
})

export type GenerateReportInput = z.infer<typeof generateReportSchema>
