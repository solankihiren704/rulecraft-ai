import { z } from 'zod'

const roleEnum = z.enum(['super_admin', 'registrar', 'hod', 'faculty', 'student'])

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  role: roleEnum,
  // The form's "None" option submits an empty string — normalize that to
  // undefined so the service treats it as "no department" instead of
  // trying (and failing) to look up an empty-string id.
  departmentId: z.string().trim().optional().transform((v) => (v ? v : undefined)),
})

export const updateUserSchema = createUserSchema

export const listUsersQuerySchema = z.object({
  search: z.string().trim().optional(),
  role: roleEnum.optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>
