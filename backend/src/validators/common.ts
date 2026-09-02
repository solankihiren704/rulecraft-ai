import { z } from 'zod'

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid id format'),
})

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
})

export type PaginationQuery = z.infer<typeof paginationQuerySchema>
