import type { Department, Student, User } from '@prisma/client'
import type { AuthUser } from '@/types'

type UserWithRelations = User & { department: Department | null; student?: Pick<Student, 'id'> | null }

/**
 * user.mapper.ts
 * The one place a Prisma User row becomes the API's AuthUser shape.
 * Never leaks passwordHash or tokenVersion — every controller returns
 * through this instead of `res.json(user)`.
 */
export function toAuthUser(user: UserWithRelations): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department?.name,
    avatarInitials: user.avatarInitials,
    ...(user.student ? { studentId: user.student.id } : {}),
  }
}
