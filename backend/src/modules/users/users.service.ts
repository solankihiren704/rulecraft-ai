import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import { ApiError } from '@/middleware/errorHandler'
import { hashPassword } from '@/utils/password'
import { findById as findDepartmentById } from '@/modules/departments/departments.repository'
import * as repo from './users.repository'
import { toAuthUser } from './user.mapper'
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './users.validators'

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function generateTempPassword(): string {
  // 12 URL-safe characters — easy to read aloud/copy, well above the 16-char
  // *hex* secrets this project generates elsewhere for JWT secrets; strong
  // enough for a one-time credential the user resets on first login (there
  // is no "must change password" flow yet, which is a real limitation —
  // noted in the integration report, not solved here).
  return crypto.randomBytes(9).toString('base64url')
}

async function assertDepartmentExists(departmentId: string) {
  const department = await findDepartmentById(departmentId)
  if (!department) throw new ApiError(400, 'That department does not exist.', { departmentId: 'Invalid department.' })
}

async function assertEmailAvailable(email: string, excludeId?: string) {
  const existing = await repo.findByEmail(email)
  if (existing && existing.id !== excludeId) {
    throw new ApiError(409, `Email "${email}" is already in use.`, { email: 'Already in use.' })
  }
}

interface CurrentCaller {
  id: string
  role: import('@/types').Role
  departmentId: string | null
}

export async function list(query: ListUsersQuery, caller?: CurrentCaller) {
  const departmentId = caller?.role === 'hod' ? (caller.departmentId ?? undefined) : undefined
  const rows = await repo.list({ ...query, departmentId })
  return rows.map(toAuthUser)
}

export async function getById(id: string, caller?: CurrentCaller) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'User not found')
  if (caller?.role === 'hod' && row.departmentId !== caller.departmentId) {
    throw new ApiError(403, 'You do not have access to users outside your department.')
  }
  return toAuthUser(row)
}

export async function create(input: CreateUserInput, caller?: CurrentCaller) {
  if (caller?.role === 'hod') {
    if (input.role !== 'faculty') {
      throw new ApiError(403, 'HODs can only add Faculty members.')
    }
    input.departmentId = caller.departmentId ?? undefined
  }

  if (input.departmentId) await assertDepartmentExists(input.departmentId)
  await assertEmailAvailable(input.email)

  const tempPassword = generateTempPassword()
  const passwordHash = await hashPassword(tempPassword)
  const row = await repo.create({
    name: input.name,
    email: input.email,
    role: input.role,
    departmentId: input.departmentId,
    avatarInitials: initialsOf(input.name),
    passwordHash,
  })

  return { user: toAuthUser(row), tempPassword }
}

export async function update(id: string, input: UpdateUserInput, caller?: CurrentCaller) {
  const current = await repo.findById(id)
  if (!current) throw new ApiError(404, 'User not found')

  if (caller?.role === 'hod') {
    if (current.departmentId !== caller.departmentId || current.role !== 'faculty') {
      throw new ApiError(403, 'HODs can only edit Faculty members within their department.')
    }
    input.role = 'faculty'
    input.departmentId = caller.departmentId ?? undefined
  }

  if (input.departmentId) await assertDepartmentExists(input.departmentId)
  if (input.email.toLowerCase() !== current.email) await assertEmailAvailable(input.email, id)

  const row = await repo.update(id, {
    name: input.name,
    email: input.email,
    role: input.role,
    departmentId: input.departmentId,
    avatarInitials: initialsOf(input.name),
  })
  return toAuthUser(row)
}

export async function remove(id: string, currentUserId: string, caller?: CurrentCaller) {
  if (id === currentUserId) {
    throw new ApiError(409, "You can't remove your own account.")
  }
  const current = await repo.findById(id)
  if (!current) throw new ApiError(404, 'User not found')

  if (caller?.role === 'hod') {
    if (current.departmentId !== caller.departmentId || current.role !== 'faculty') {
      throw new ApiError(403, 'HODs can only remove Faculty members within their department.')
    }
  }

  try {
    await repo.remove(id)
  } catch (err) {
    // Prisma normally surfaces a FK-restrict violation as a
    // PrismaClientKnownRequestError with code P2003, but this project's
    // driver-adapter engine (Prisma 7 + @prisma/adapter-pg) instead throws
    // a plain Error wrapping Postgres's own "RestrictViolation" (SQLSTATE
    // 23001) — so both shapes are checked here.
    const message = err instanceof Error ? err.message : ''
    const isForeignKeyViolation =
      (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') ||
      message.includes('RestrictViolation') ||
      message.includes('foreign key constraint')
    if (isForeignKeyViolation) {
      throw new ApiError(
        409,
        `${current.name} has created other records (regulations, versions, approvals, simulations, or reports) and can't be removed. Reassign or archive that work first.`,
      )
    }
    throw err
  }
}
