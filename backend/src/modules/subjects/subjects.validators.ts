import { z } from 'zod'

export const createSubjectSchema = z.object({
  code: z.string().trim().min(2, 'Code is required.').toUpperCase(),
  name: z.string().trim().min(2, 'Name is required.'),
  credits: z.coerce.number().int().min(1).max(10),
  semesterId: z.string().uuid('Select a semester.'),
})

export const updateSubjectSchema = createSubjectSchema

export const listSubjectsQuerySchema = z.object({
  semesterId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
})

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>
