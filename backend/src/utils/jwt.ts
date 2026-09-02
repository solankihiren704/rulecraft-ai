import jwt from 'jsonwebtoken'
import { env } from '@/config/env'
import type { Role } from '@/types'

export interface AccessTokenPayload {
  sub: string // user id
  role: Role
  departmentId?: string | null
}

export interface RefreshTokenPayload {
  sub: string // user id
  tokenVersion: number
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] })
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload & jwt.JwtPayload
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload & jwt.JwtPayload
}

export const REFRESH_COOKIE_NAME = 'rulecraft_refresh_token'
