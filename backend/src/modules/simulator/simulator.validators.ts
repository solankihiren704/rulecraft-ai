import { z } from 'zod'

export const runSimulationSchema = z.object({
  regulationId: z.string().uuid('Select a regulation.'),
  studentId: z.string().uuid().optional(),
  customValues: z.record(z.string(), z.string()).default({}),
})

export const listHistoryQuerySchema = z.object({
  regulationId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
})

export type RunSimulationInput = z.infer<typeof runSimulationSchema>
export type ListHistoryQuery = z.infer<typeof listHistoryQuerySchema>
