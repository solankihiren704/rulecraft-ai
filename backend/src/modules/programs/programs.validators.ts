import { z } from 'zod'

export const createProgramSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.'),
  code: z.string().trim().min(2, 'Code is required.').toUpperCase(),
  departmentId: z.string().uuid('Select a department.'),
  years: z.coerce.number().int().min(1).max(6),
})

export const updateProgramSchema = createProgramSchema

export const listProgramsQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
})

export type CreateProgramInput = z.infer<typeof createProgramSchema>
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>
