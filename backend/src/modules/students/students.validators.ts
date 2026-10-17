import { z } from 'zod'

export const createStudentSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  studentId: z.string().trim().min(3, 'Student ID is required.'),
  programId: z.string().uuid('Select a program.'),
  year: z.coerce.number().int().min(1).max(6),
  status: z.enum(['active', 'suspended', 'graduated']).default('active'),
  gpa: z.coerce.number().min(0, 'GPA cannot be negative.').max(10, 'GPA cannot exceed 10.'),
  attendance: z.coerce.number().min(0, 'Attendance cannot be negative.').max(100, 'Attendance cannot exceed 100%.').optional().default(85),
})

export const updateStudentSchema = createStudentSchema

export const listStudentsQuerySchema = z.object({
  search: z.string().trim().optional(),
  programId: z.string().uuid().optional(),
  year: z.coerce.number().int().optional(),
  status: z.enum(['active', 'suspended', 'graduated']).optional(),
})

export const importStudentRowSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  studentId: z.string().trim().min(3, 'Student ID is required.'),
  programCode: z.string().trim().min(1, 'Program code is required.').toUpperCase(),
  departmentName: z.string().trim().optional(),
  departmentCode: z.string().trim().optional(),
  programName: z.string().trim().optional(),
  year: z.preprocess((val) => {
    if (typeof val === 'string') {
      const match = val.match(/\d+/)
      return match ? Number(match[0]) : val
    }
    return val
  }, z.coerce.number().int().min(1, 'Year must be at least 1.').max(6, 'Year cannot exceed 6.')),
  status: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        const lower = val.trim().toLowerCase()
        if (!lower || lower === 'active' || lower === 'enrolled' || lower === 'regular') return 'active'
        if (lower === 'suspended' || lower === 'inactive' || lower === 'detained') return 'suspended'
        if (lower === 'graduated' || lower === 'passed' || lower === 'completed') return 'graduated'
        return lower
      }
      return val ?? 'active'
    }, z.enum(['active', 'suspended', 'graduated']))
    .default('active'),
  gpa: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? 3.5 : val),
    z.coerce.number().min(0, 'GPA cannot be negative.').max(10, 'GPA cannot exceed 10.'),
  ),
  attendance: z.preprocess((val) => {
    if (typeof val === 'string') {
      const cleaned = val.replace(/%/g, '').trim()
      return cleaned === '' ? 85 : Number(cleaned)
    }
    return val ?? 85
  }, z.coerce.number().min(0, 'Attendance cannot be negative.').max(100, 'Attendance cannot exceed 100%.').default(85)),
})

export const importTemplateQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
})

// Bounded well above any real bulk-selection size — export renders every
// row into a PDF/CSV buffer in memory, so this keeps that bounded too.
export const MAX_EXPORT_STUDENTS = 500

export const exportStudentsSchema = z.object({
  studentIds: z
    .array(z.string().uuid())
    .min(1, 'Select at least one student.')
    .max(MAX_EXPORT_STUDENTS, `A single export is limited to ${MAX_EXPORT_STUDENTS} students.`),
  format: z.enum(['csv', 'pdf']),
})

export type CreateStudentInput = z.infer<typeof createStudentSchema>
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>
export type ImportStudentRow = z.infer<typeof importStudentRowSchema>
export type ImportTemplateQuery = z.infer<typeof importTemplateQuerySchema>
export type ExportStudentsInput = z.infer<typeof exportStudentsSchema>
