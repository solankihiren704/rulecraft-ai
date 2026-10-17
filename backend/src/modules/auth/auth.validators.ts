import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email or Student ID is required.'),
  password: z.string().min(1, 'Password is required.'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters.'),
})

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export const registerStudentSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid university email.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  studentId: z.string().trim().min(3, 'Student ID / Roll Number is required.').toUpperCase(),
  programId: z.string().uuid('Please select a valid academic program.'),
  year: z.coerce.number().int().min(1).max(6).default(1),
})

export type RegisterStudentInput = z.infer<typeof registerStudentSchema>
