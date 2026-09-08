// Shared domain types, kept in sync with backend/src/types/index.ts — these
// are the wire-format shapes returned by the real API (see frontend/src/api/*).
// A few types here (AiMessage, NotificationItem) are still mock-only: the
// AI and Notifications backend modules haven't been built yet.

export type Role = 'super_admin' | 'registrar' | 'hod' | 'faculty' | 'student'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
  department?: string
  avatarInitials: string
  // Only ever set for the 'student' role — the id of this login's linked
  // Student record (see backend/src/modules/users/user.mapper.ts).
  studentId?: string
}

export interface Department {
  id: string
  name: string
  code: string
}

export interface Program {
  id: string
  name: string
  code: string
  departmentId: string
  years: number
}

export interface Semester {
  id: string
  name: string
  programId: string
  year: number
  startDate: string
  endDate: string
}

export interface Subject {
  id: string
  code: string
  name: string
  credits: number
  semesterId: string
}

export type StudentStatus = 'active' | 'suspended' | 'graduated'

export interface Student {
  id: string
  name: string
  email: string
  studentId: string
  programId: string
  year: number
  status: StudentStatus
  gpa: number
  enrollDate: string
}

export type RegulationStatus = 'draft' | 'review' | 'published' | 'archived'

export interface RegulationVersion {
  version: string
  changeSummary: string
  changedBy: string
  changedAt: string
}

export interface ApprovalStep {
  step: 'submitted' | 'reviewed' | 'approved' | 'rejected' | 'published'
  by: string
  at: string
  note?: string
}

export interface Regulation {
  id: string
  name: string
  code: string
  version: string
  status: RegulationStatus
  effectiveDate: string
  lastModified: string
  programId: string
  description: string
  versions: RegulationVersion[]
  approvalHistory: ApprovalStep[]
}

export type RuleType =
  | 'attendance'
  | 'passing'
  | 'grading'
  | 'promotion'
  | 'backlog'
  | 'grace_marks'

export type RuleOperator =
  | 'gte'
  | 'lte'
  | 'gt'
  | 'lt'
  | 'eq'
  | 'neq'

export interface LeafCondition {
  type: 'condition'
  field: string
  operator: RuleOperator
  value: string
}

export interface ConditionGroup {
  type: 'group'
  operator: 'AND' | 'OR'
  children: ConditionNode[]
}

export type ConditionNode = LeafCondition | ConditionGroup

export interface Rule {
  id: string
  regulationId: string
  name: string
  type: RuleType
  conditionTree: ConditionNode
  outcome: string
  active: boolean
}

export interface NotificationItem {
  id: string
  title: string
  detail: string
  time: string
  read: boolean
  tone: 'teal' | 'blue' | 'coral' | 'amber'
}

export interface AiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  at: string
}

export type SimulationOutcome = 'eligible' | 'not_eligible' | 'eligible_with_conditions'

export interface SimulationResult {
  id: string
  studentId: string
  studentName: string
  regulationId: string
  ranAt: string
  outcome: SimulationOutcome
  breakdown: { rule: string; passed: boolean; detail: string }[]
}

export type ReportType = 'eligibility-summary' | 'attendance-audit' | 'promotion-outcomes' | 'regulation-compliance'
export type ReportFormat = 'csv' | 'pdf' | 'excel'

export interface ReportSummary {
  id: string
  reportType: ReportType
  format: ReportFormat
  programId: string | null
  programName: string | null
  regulationId: string | null
  regulationName: string | null
  generatedById: string
  generatedByName: string
  generatedAt: string
}

export interface DashboardActivityItem {
  type: 'approval_step' | 'regulation_version' | 'simulation'
  description: string
  at: string
}

export interface DashboardSummary {
  students: { total: number; active: number; byDepartment: { departmentName: string; count: number }[] } | null
  regulations: { total: number; byStatus: { status: RegulationStatus; count: number }[] }
  rules: { total: number; active: number; byType: { type: RuleType; count: number }[] }
  simulations: {
    total: number
    byOutcome: { outcome: SimulationOutcome; count: number }[]
    byDay: { date: string; count: number }[]
  }
  reports: { totalGeneratedByMe: number } | null
  recentActivity: DashboardActivityItem[]
  generatedAt: string
}
