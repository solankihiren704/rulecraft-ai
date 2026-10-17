import type { Request, Response } from 'express'
import { isProduction } from '@/config/env'
import { ApiError } from '@/middleware/errorHandler'
import { REFRESH_COOKIE_NAME } from '@/utils/jwt'
import { created, ok } from '@/utils/apiResponse'
import * as authService from './auth.service'

const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days, matches JWT_REFRESH_EXPIRES_IN default

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/api/auth',
  })
}

export async function register(req: Request, res: Response) {
  const { user, accessToken, refreshToken } = await authService.registerStudent(req.body)
  setRefreshCookie(res, refreshToken)
  return created(res, { user, accessToken }, 'Student account created successfully.')
}

export async function login(req: Request, res: Response) {
  const { user, accessToken, refreshToken } = await authService.login(req.body)
  setRefreshCookie(res, refreshToken)
  return ok(res, { user, accessToken })
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME]
  if (!token) throw new ApiError(401, 'Session expired. Please sign in again.')

  const { user, accessToken, refreshToken } = await authService.refresh(token)
  setRefreshCookie(res, refreshToken)
  return ok(res, { user, accessToken })
}

export async function logout(req: Request, res: Response) {
  if (req.user) await authService.logout(req.user.id)
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' })
  return ok(res, null, 'Logged out.')
}

export async function changePassword(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, 'Authentication required.')
  const { user, accessToken, refreshToken } = await authService.changePassword(req.user.id, req.body)
  setRefreshCookie(res, refreshToken)
  return ok(res, { user, accessToken }, 'Password updated successfully.')
}

export async function me(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, 'Authentication required')
  const user = await authService.me(req.user.id)
  return ok(res, user)
}
