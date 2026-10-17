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

export async function findUserByStudentId(studentId: string) {
  const student = await prisma.student.findFirst({
    where: { studentId: { equals: studentId.trim(), mode: 'insensitive' } },
    include: {
      user: {
        include: { department: true, student: { select: { id: true } } },
      },
    },
  })
  return student?.user ?? null
}

export function updatePassword(userId: string, passwordHash: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash, tokenVersion: { increment: 1 } },
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
