import { ApiRequestError, apiClient, refreshSession, type AuthSessionPayload } from './client'
import type { AuthUser } from '@/types'

export interface RegisterStudentData {
  name: string
  email: string
  password: string
  studentId: string
  programId: string
  year: number
}

export async function register(data: RegisterStudentData): Promise<AuthSessionPayload> {
  const res = await apiClient.post<{ success: true; data: AuthSessionPayload }>('/auth/register', data)
  return res.data.data
}

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

export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthSessionPayload> {
  const res = await apiClient.post<{ success: true; data: AuthSessionPayload }>('/auth/change-password', {
    currentPassword,
    newPassword,
  })
  return res.data.data
}
