import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocked at the module level so these tests exercise auth.service's logic
// in isolation, without a live database — consistent with this project's
// existing test setup (vitest.config.mts runs with a dummy DATABASE_URL).
vi.mock('../src/modules/auth/auth.repository', () => ({
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  bumpTokenVersion: vi.fn(),
}))
vi.mock('../src/utils/password', () => ({
  comparePassword: vi.fn(),
  hashPassword: vi.fn(),
}))

import { login, refresh, logout } from '../src/modules/auth/auth.service'
import * as repo from '../src/modules/auth/auth.repository'
import { comparePassword } from '../src/utils/password'
import { signRefreshToken, verifyRefreshToken } from '../src/utils/jwt'
import { ApiError } from '../src/middleware/errorHandler'

const baseUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@rulecraft.edu',
  passwordHash: 'hashed',
  role: 'faculty' as const,
  avatarInitials: 'TU',
  departmentId: null,
  isActive: true,
  tokenVersion: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  department: null,
}

describe('auth.service login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects an unknown email without revealing that it does not exist', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(null)
    await expect(login({ email: 'nobody@nowhere.com', password: 'x' })).rejects.toMatchObject({
      statusCode: 401,
      message: 'No account matches that email and password.',
    })
  })

  it('rejects a deactivated user even with the correct password', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue({ ...baseUser, isActive: false })
    await expect(login({ email: baseUser.email, password: 'x' })).rejects.toBeInstanceOf(ApiError)
  })

  it('rejects a wrong password', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(baseUser)
    vi.mocked(comparePassword).mockResolvedValue(false)
    await expect(login({ email: baseUser.email, password: 'wrong' })).rejects.toMatchObject({ statusCode: 401 })
  })

  it('returns a user and token pair on success, never the password hash', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(baseUser)
    vi.mocked(comparePassword).mockResolvedValue(true)
    const result = await login({ email: baseUser.email, password: 'correct' })
    expect(result.user).not.toHaveProperty('passwordHash')
    expect(result.accessToken).toBeTruthy()
    expect(result.refreshToken).toBeTruthy()
  })
})

describe('auth.service refresh', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a refresh token whose version no longer matches the stored one (rotation/replay)', async () => {
    const staleToken = signRefreshToken({ sub: baseUser.id, tokenVersion: 0 })
    vi.mocked(repo.findUserById).mockResolvedValue({ ...baseUser, tokenVersion: 1 })
    await expect(refresh(staleToken)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rotates successfully when the token version matches', async () => {
    const currentToken = signRefreshToken({ sub: baseUser.id, tokenVersion: 0 })
    vi.mocked(repo.findUserById).mockResolvedValue(baseUser)
    vi.mocked(repo.bumpTokenVersion).mockResolvedValue({ ...baseUser, tokenVersion: 1 })
    const result = await refresh(currentToken)
    expect(result.accessToken).toBeTruthy()
    expect(repo.bumpTokenVersion).toHaveBeenCalledWith(baseUser.id)
  })

  it('rejects a garbage token', async () => {
    await expect(refresh('not-a-real-jwt')).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('auth.service logout', () => {
  it('bumps the token version, invalidating outstanding refresh tokens', async () => {
    vi.mocked(repo.bumpTokenVersion).mockResolvedValue(baseUser)
    await logout(baseUser.id)
    expect(repo.bumpTokenVersion).toHaveBeenCalledWith(baseUser.id)
  })
})

// Sanity check on the utility itself, independent of the service.
describe('jwt refresh token round-trip', () => {
  it('verifies a token it signed', () => {
    const token = signRefreshToken({ sub: 'abc', tokenVersion: 2 })
    expect(verifyRefreshToken(token)).toMatchObject({ sub: 'abc', tokenVersion: 2 })
  })
})
