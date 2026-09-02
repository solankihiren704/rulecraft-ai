import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '@/middleware/errorHandler'
import type { Role } from '@/types'

/**
 * authorize.ts
 * Role-gate for a route: authorize('super_admin', 'registrar') returns 403
 * for anyone else. Always mounted after authenticate(), which guarantees
 * req.user exists by the time this runs.
 *
 * Department-level scoping (HOD/Faculty limited to "their" department) is
 * NOT done here — it needs the target record's departmentId loaded first,
 * so it lives in the service layer via assertInScope() below, called
 * after the repository fetch.
 */
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, 'You do not have permission to perform this action')
    }
    next()
  }
}

/**
 * assertInScope
 * Row-level check for HOD/Faculty: they may only act on records belonging
 * to their own department. Super Admin and Registrar bypass this (they are
 * not department-scoped). Call from a service after loading the record,
 * e.g. assertInScope(req.user, student.program.departmentId).
 */
export function assertInScope(
  user: { role: Role; departmentId: string | null },
  recordDepartmentId: string | null | undefined,
) {
  if (user.role === 'super_admin' || user.role === 'registrar') return

  if (user.role === 'hod' || user.role === 'faculty') {
    if (!user.departmentId || user.departmentId !== recordDepartmentId) {
      throw new ApiError(403, 'This record is outside your department')
    }
    return
  }

  // students never reach here — their endpoints scope to "self" instead,
  // checked directly in the relevant service (see students/simulator modules).
  throw new ApiError(403, 'You do not have permission to perform this action')
}
