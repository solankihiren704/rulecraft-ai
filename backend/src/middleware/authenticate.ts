import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '@/middleware/errorHandler'
import { verifyAccessToken } from '@/utils/jwt'

/**
 * authenticate.ts
 * Verifies the Authorization: Bearer <accessToken> header and attaches
 * req.user. Stateless by design — the access token is short-lived (15m by
 * default), so its payload (role, departmentId) is trusted for that window
 * instead of hitting the database on every request. A role/department
 * change takes effect on the user's next token refresh at most.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentication required')
  }

  const token = header.slice('Bearer '.length)

  try {
    const payload = verifyAccessToken(token)
    req.user = { id: payload.sub, role: payload.role, departmentId: payload.departmentId ?? null }
    next()
  } catch {
    throw new ApiError(401, 'Invalid or expired access token')
  }
}
