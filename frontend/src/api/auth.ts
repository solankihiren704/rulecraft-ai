import { ApiRequestError, apiClient, refreshSession, type AuthSessionPayload } from './client'
import type { AuthUser } from '@/types'

export async function login(email: string, password: string): Promise<AuthSessionPayload> {
  const res = await apiClient.post<{ success: true; data: AuthSessionPayload }>('/auth/login', { email, password })
  return res.data.data
}

export async function refresh(): Promise<AuthSessionPayload> {
  const session = await refreshSession()
  if (!session) throw new ApiRequestError('Session expired. Please sign in again.', 401)
  return session
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout')
}

export async function me(): Promise<AuthUser> {
  const res = await apiClient.get<{ success: true; data: AuthUser }>('/auth/me')
  return res.data.data
}
