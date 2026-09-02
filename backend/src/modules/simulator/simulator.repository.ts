import { prisma } from '@/config/prisma'

export function findRegulationWithActiveRules(regulationId: string) {
  return prisma.regulation.findUnique({
    where: { id: regulationId },
    include: { rules: { where: { active: true }, include: { conditions: true } } },
  })
}

export function findStudentById(studentId: string) {
  return prisma.student.findUnique({ where: { id: studentId }, include: { program: { select: { departmentId: true } } } })
}

export function create(data: {
  studentId: string | null
  studentName: string
  regulationId: string
  ranById: string
  outcome: 'eligible' | 'not_eligible' | 'eligible_with_conditions'
  breakdown: { ruleName: string; passed: boolean; detail: string }[]
}) {
  return prisma.simulationResult.create({
    data: {
      studentId: data.studentId,
      studentName: data.studentName,
      regulationId: data.regulationId,
      ranById: data.ranById,
      outcome: data.outcome,
      breakdown: { create: data.breakdown },
    },
    include: { breakdown: true },
  })
}

export function listHistory(filters: { regulationId?: string; studentId?: string; ranById?: string }) {
  return prisma.simulationResult.findMany({
    where: { regulationId: filters.regulationId, studentId: filters.studentId, ranById: filters.ranById },
    include: { breakdown: true },
    orderBy: { ranAt: 'desc' },
    take: 50,
  })
}
