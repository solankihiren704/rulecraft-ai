import { prisma } from '@/config/prisma'
import type { Role } from '@prisma/client'

export const detailInclude = { department: true, student: { select: { id: true } } }

export interface UserFilters {
  search?: string
  role?: Role
  departmentId?: string
}

export function list(filters: UserFilters) {
  return prisma.user.findMany({
    where: {
      role: filters.role,
      departmentId: filters.departmentId,
      OR: filters.search
        ? [
            { name: { contains: filters.search, mode: 'insensitive' as const } },
            { email: { contains: filters.search, mode: 'insensitive' as const } },
          ]
        : undefined,
    },
    include: detailInclude,
    orderBy: { name: 'asc' },
  })
}

export function findById(id: string) {
  return prisma.user.findUnique({ where: { id }, include: detailInclude })
}

export function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } })
}

export function create(data: { name: string; email: string; role: Role; departmentId?: string; avatarInitials: string; passwordHash: string }) {
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      role: data.role,
      departmentId: data.departmentId ?? null,
      avatarInitials: data.avatarInitials,
      passwordHash: data.passwordHash,
    },
    include: detailInclude,
  })
}

export function update(id: string, data: { name: string; email: string; role: Role; departmentId?: string; avatarInitials: string }) {
  return prisma.user.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      role: data.role,
      departmentId: data.departmentId ?? null,
      avatarInitials: data.avatarInitials,
    },
    include: detailInclude,
  })
}

export function remove(id: string) {
  return prisma.user.delete({ where: { id } })
}
