import { apiClient } from './client'
import type { AuthUser, Role } from '@/types'

export interface ListUsersParams {
  search?: string
  role?: Role
}

export interface UserInput {
  name: string
  email: string
  role: Role
  departmentId?: string
}

export interface CreateUserResult {
  user: AuthUser
  // One-time temporary password — there's no email system to deliver it,
  // so the caller must show it to the admin right after creation.
  tempPassword: string
}

export async function list(params?: ListUsersParams): Promise<AuthUser[]> {
  const res = await apiClient.get<{ success: true; data: AuthUser[] }>('/users', { params })
  return res.data.data
}

export async function create(input: UserInput): Promise<CreateUserResult> {
  const res = await apiClient.post<{ success: true; data: CreateUserResult }>('/users', input)
  return res.data.data
}

export async function update(id: string, input: UserInput): Promise<AuthUser> {
  const res = await apiClient.patch<{ success: true; data: AuthUser }>(`/users/${id}`, input)
  return res.data.data
}

export async function remove(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`)
}
