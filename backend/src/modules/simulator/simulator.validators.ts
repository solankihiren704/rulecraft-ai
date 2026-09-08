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

// Capped well above any real class/department size so a batch stays a
// bounded, sequential loop of real DB writes rather than an unbounded one.
export const MAX_BATCH_STUDENTS = 200

export const batchSimulationSchema = z.object({
  regulationId: z.string().uuid('Select a regulation.'),
  studentIds: z
    .array(z.string().uuid())
    .min(1, 'Select at least one student.')
    .max(MAX_BATCH_STUDENTS, `A single batch is limited to ${MAX_BATCH_STUDENTS} students.`),
  customValues: z.record(z.string(), z.string()).default({}),
})

export type RunSimulationInput = z.infer<typeof runSimulationSchema>
export type ListHistoryQuery = z.infer<typeof listHistoryQuerySchema>
export type BatchSimulationInput = z.infer<typeof batchSimulationSchema>
