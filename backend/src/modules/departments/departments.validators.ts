import { z } from 'zod'

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.'),
  code: z.string().trim().min(2, 'Code is required.').toUpperCase(),
})

export const updateDepartmentSchema = createDepartmentSchema

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>
