import { z } from 'zod'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.')

export const createRegulationSchema = z.object({
  name: z.string().trim().min(3, 'Name must be at least 3 characters.'),
  code: z.string().trim().min(3, 'Code is required.').toUpperCase(),
  programId: z.string().uuid('Select a program.'),
  effectiveDate: dateOnly,
  description: z.string().trim().min(10, 'Add at least a short description (10+ characters).'),
})

export const updateRegulationSchema = createRegulationSchema

export const listRegulationsQuerySchema = z.object({
  status: z.enum(['draft', 'review', 'published', 'archived']).optional(),
  programId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
})

export const reviewRegulationSchema = z.object({
  note: z.string().trim().min(1, 'Add a review note.').optional(),
})

export const rejectRegulationSchema = z.object({
  note: z.string().trim().min(1, 'A reason is required when rejecting a regulation.'),
})

export const versionDiffQuerySchema = z.object({
  fromVersionId: z.string().uuid('Select a version to compare from.'),
  toVersionId: z.string().uuid('Select a version to compare to.'),
})

export type CreateRegulationInput = z.infer<typeof createRegulationSchema>
export type UpdateRegulationInput = z.infer<typeof updateRegulationSchema>
export type ListRegulationsQuery = z.infer<typeof listRegulationsQuerySchema>
export type VersionDiffQuery = z.infer<typeof versionDiffQuerySchema>
