import { z } from 'zod'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.')

export const createSemesterSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is required.'),
    programId: z.string().uuid('Select a program.'),
    year: z.coerce.number().int().min(1).max(6),
    startDate: dateOnly,
    endDate: dateOnly,
  })
  .refine((data) => data.endDate > data.startDate, {
    message: 'End date must be after the start date.',
    path: ['endDate'],
  })

export const updateSemesterSchema = createSemesterSchema

export const listSemestersQuerySchema = z.object({
  programId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
})

export type CreateSemesterInput = z.infer<typeof createSemesterSchema>
export type UpdateSemesterInput = z.infer<typeof updateSemesterSchema>
