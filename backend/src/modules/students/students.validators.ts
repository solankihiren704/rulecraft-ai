import { z } from 'zod'

export const createStudentSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  studentId: z.string().trim().min(3, 'Student ID is required.'),
  programId: z.string().uuid('Select a program.'),
  year: z.coerce.number().int().min(1).max(6),
  status: z.enum(['active', 'suspended', 'graduated']).default('active'),
  gpa: z.coerce.number().min(0, 'GPA cannot be negative.').max(10, 'GPA cannot exceed 10.'),
})

export const updateStudentSchema = createStudentSchema

export const listStudentsQuerySchema = z.object({
  search: z.string().trim().optional(),
  programId: z.string().uuid().optional(),
  year: z.coerce.number().int().optional(),
  status: z.enum(['active', 'suspended', 'graduated']).optional(),
})

export type CreateStudentInput = z.infer<typeof createStudentSchema>
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>
