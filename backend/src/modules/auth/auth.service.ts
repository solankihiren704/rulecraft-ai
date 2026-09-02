import { ApiError } from '@/middleware/errorHandler'
import { comparePassword } from '@/utils/password'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/utils/jwt'
import { toAuthUser } from '@/modules/users/user.mapper'
import { bumpTokenVersion, findUserByEmail, findUserById } from './auth.repository'
import type { LoginInput } from './auth.validators'

async function issueTokenPair(user: { id: string; role: import('@/types').Role; departmentId: string | null; tokenVersion: number }) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, departmentId: user.departmentId })
  const refreshToken = signRefreshToken({ sub: user.id, tokenVersion: user.tokenVersion })
  return { accessToken, refreshToken }
}

export async function login({ email, password }: LoginInput) {
  const user = await findUserByEmail(email)
  if (!user || !user.isActive) {
    throw new ApiError(401, 'No account matches that email and password.')
  }

  const passwordMatches = await comparePassword(password, user.passwordHash)
  if (!passwordMatches) {
    throw new ApiError(401, 'No account matches that email and password.')
  }

  const { accessToken, refreshToken } = await issueTokenPair(user)
  return { user: toAuthUser(user), accessToken, refreshToken }
}

export async function refresh(refreshToken: string) {
  let payload: ReturnType<typeof verifyRefreshToken>
  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    throw new ApiError(401, 'Session expired. Please sign in again.')
  }

  const user = await findUserById(payload.sub)
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Session expired. Please sign in again.')
  }

  // Rotation: a refresh token is single-use. If its embedded version no
  // longer matches the stored one, it's either already been used once
  // (replay) or was invalidated by a logout — either way, reject it.
  if (user.tokenVersion !== payload.tokenVersion) {
    throw new ApiError(401, 'Session expired. Please sign in again.')
  }

  const rotated = await bumpTokenVersion(user.id)
  const tokens = await issueTokenPair(rotated)
  return { user: toAuthUser(rotated), ...tokens }
}

export async function logout(userId: string) {
  await bumpTokenVersion(userId)
}

export async function me(userId: string) {
  const user = await findUserById(userId)
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Session expired. Please sign in again.')
  }
  return toAuthUser(user)
}
