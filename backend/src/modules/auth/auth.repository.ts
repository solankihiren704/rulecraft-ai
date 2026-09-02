import { prisma } from '@/config/prisma'

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { department: true, student: { select: { id: true } } },
  })
}

export function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: { department: true, student: { select: { id: true } } },
  })
}

export function bumpTokenVersion(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
    include: { department: true, student: { select: { id: true } } },
  })
}
