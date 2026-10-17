import { prisma } from '@/config/prisma'
import { ApiError } from '@/middleware/errorHandler'
import { comparePassword, hashPassword } from '@/utils/password'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/utils/jwt'
import { toAuthUser } from '@/modules/users/user.mapper'
import { bumpTokenVersion, findUserByEmail, findUserById, findUserByStudentId, updatePassword } from './auth.repository'
import type { ChangePasswordInput, LoginInput, RegisterStudentInput } from './auth.validators'

async function issueTokenPair(user: { id: string; role: import('@/types').Role; departmentId: string | null; tokenVersion: number }) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, departmentId: user.departmentId })
  const refreshToken = signRefreshToken({ sub: user.id, tokenVersion: user.tokenVersion })
  return { accessToken, refreshToken }
}

export async function registerStudent(input: RegisterStudentInput) {
  const email = input.email.toLowerCase()
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    throw new ApiError(409, `An account with email "${email}" already exists.`, { email: 'Already in use.' })
  }

  const existingStudent = await prisma.student.findFirst({
    where: { OR: [{ email }, { studentId: input.studentId }] },
  })
  if (existingStudent) {
    throw new ApiError(409, 'A student with this ID or email is already registered.', {
      studentId: existingStudent.studentId === input.studentId ? 'Already registered.' : 'Conflict',
      email: existingStudent.email === email ? 'Already registered.' : 'Conflict',
    })
  }

  const program = await prisma.program.findUnique({
    where: { id: input.programId },
    include: { department: true },
  })
  if (!program) {
    throw new ApiError(400, 'Selected academic program does not exist.', { programId: 'Invalid program.' })
  }

  const passwordHash = await hashPassword(input.password)
  const initials = input.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email,
      passwordHash,
      role: 'student',
      departmentId: program.departmentId,
      avatarInitials: initials,
    },
    include: {
      department: true,
    },
  })

  const student = await prisma.student.create({
    data: {
      name: input.name,
      email,
      studentId: input.studentId,
      programId: program.id,
      year: input.year,
      status: 'active',
      gpa: 3.5,
      enrollDate: new Date(),
      userId: user.id,
    },
  })

  const tokens = await issueTokenPair(user)
  return {
    user: toAuthUser({ ...user, student: { id: student.id } }),
    ...tokens,
  }
}

export async function login({ email, password }: LoginInput) {
  const trimmed = email.trim()
  let user = trimmed.includes('@')
    ? await findUserByEmail(trimmed)
    : await findUserByStudentId(trimmed)

  if (!user && !trimmed.includes('@')) {
    user = await findUserByEmail(trimmed)
  }

  if (!user || !user.isActive) {
    throw new ApiError(401, 'No account matches that Email or Student ID and password.')
  }

  const passwordMatches = await comparePassword(password, user.passwordHash)
  if (!passwordMatches) {
    throw new ApiError(401, 'No account matches that Email or Student ID and password.')
  }

  const { accessToken, refreshToken } = await issueTokenPair(user)
  return { user: toAuthUser(user), accessToken, refreshToken }
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await findUserById(userId)
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Session expired. Please sign in again.')
  }

  const matches = await comparePassword(input.currentPassword, user.passwordHash)
  if (!matches) {
    throw new ApiError(400, 'Current password does not match.')
  }

  const newHash = await hashPassword(input.newPassword)
  const updated = await updatePassword(userId, newHash)
  const tokens = await issueTokenPair(updated)
  return { user: toAuthUser(updated), ...tokens }
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
