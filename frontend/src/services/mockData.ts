import type {
  AiMessage,
  ApprovalStep,
  AuthUser,
  Department,
  NotificationItem,
  Program,
  Regulation,
  Rule,
  Semester,
  SimulationResult,
  Student,
  Subject,
} from '@/types'

// Centralized mock data (Phase 1 — no backend yet). Every feature page reads
// from here so cross-references (department -> program -> student counts,
// regulation -> rules, etc.) stay consistent across the app instead of each
// page inventing its own disconnected numbers.

export const departments: Department[] = [
  { id: 'dept-cse', name: 'Computer Science', code: 'CSE' },
  { id: 'dept-ece', name: 'Electronics', code: 'ECE' },
  { id: 'dept-me', name: 'Mechanical Engineering', code: 'ME' },
  { id: 'dept-ce', name: 'Civil Engineering', code: 'CE' },
]

export const programs: Program[] = [
  { id: 'prog-btcs', name: 'B.Tech Computer Science', code: 'BTCS', departmentId: 'dept-cse', years: 4 },
  { id: 'prog-mtcs', name: 'M.Tech Computer Science', code: 'MTCS', departmentId: 'dept-cse', years: 2 },
  { id: 'prog-bte', name: 'B.Tech Electronics', code: 'BTE', departmentId: 'dept-ece', years: 4 },
  { id: 'prog-btm', name: 'B.Tech Mechanical', code: 'BTM', departmentId: 'dept-me', years: 4 },
  { id: 'prog-bce', name: 'B.Tech Civil', code: 'BCE', departmentId: 'dept-ce', years: 4 },
]

export const semesters: Semester[] = [
  { id: 'sem-1', name: 'Semester 1', programId: 'prog-btcs', year: 1, startDate: '2024-01-08', endDate: '2024-04-30' },
  { id: 'sem-2', name: 'Semester 2', programId: 'prog-btcs', year: 1, startDate: '2024-06-01', endDate: '2024-09-15' },
  { id: 'sem-3', name: 'Semester 3', programId: 'prog-btcs', year: 2, startDate: '2024-01-08', endDate: '2024-04-30' },
  { id: 'sem-4', name: 'Semester 1', programId: 'prog-bte', year: 1, startDate: '2024-01-08', endDate: '2024-04-30' },
]

export const subjects: Subject[] = [
  { id: 'subj-1', code: 'CS101', name: 'Programming Fundamentals', credits: 4, semesterId: 'sem-1' },
  { id: 'subj-2', code: 'CS102', name: 'Data Structures', credits: 4, semesterId: 'sem-1' },
  { id: 'subj-3', code: 'CS201', name: 'Algorithms', credits: 4, semesterId: 'sem-3' },
  { id: 'subj-4', code: 'CS202', name: 'Database Management', credits: 3, semesterId: 'sem-3' },
]

export const students: Student[] = [
  { id: 'stu-1', name: 'Rajesh Kumar', email: 'rajesh.kumar@university.edu', studentId: 'STU2024001', programId: 'prog-btcs', year: 4, status: 'active', gpa: 3.8, enrollDate: '2020-08-15' },
  { id: 'stu-2', name: 'Priya Sharma', email: 'priya.sharma@university.edu', studentId: 'STU2024002', programId: 'prog-bte', year: 3, status: 'active', gpa: 3.6, enrollDate: '2021-08-20' },
  { id: 'stu-3', name: 'Ananya Patel', email: 'ananya.patel@university.edu', studentId: 'STU2024003', programId: 'prog-btcs', year: 2, status: 'active', gpa: 3.9, enrollDate: '2022-08-10' },
  { id: 'stu-4', name: 'Arjun Singh', email: 'arjun.singh@university.edu', studentId: 'STU2024004', programId: 'prog-btm', year: 4, status: 'suspended', gpa: 2.1, enrollDate: '2020-08-15' },
  { id: 'stu-5', name: 'Neha Gupta', email: 'neha.gupta@university.edu', studentId: 'STU2024005', programId: 'prog-bce', year: 1, status: 'active', gpa: 3.7, enrollDate: '2023-08-05' },
  { id: 'stu-6', name: 'Vikram Rao', email: 'vikram.rao@university.edu', studentId: 'STU2024006', programId: 'prog-btcs', year: 3, status: 'active', gpa: 2.9, enrollDate: '2021-08-20' },
  { id: 'stu-7', name: 'Ishita Bose', email: 'ishita.bose@university.edu', studentId: 'STU2024007', programId: 'prog-mtcs', year: 1, status: 'graduated', gpa: 3.95, enrollDate: '2019-08-15' },
]

const approvalHistoryPublished: ApprovalStep[] = [
  { step: 'submitted', by: 'Aarav Kulkarni', at: '2024-07-01T09:00:00Z', note: 'Initial draft submitted for review.' },
  { step: 'reviewed', by: 'Dr. Meera Nair (HOD)', at: '2024-07-05T11:30:00Z', note: 'Reviewed, minor clarifications requested.' },
  { step: 'approved', by: 'Academic Council', at: '2024-07-12T14:00:00Z' },
  { step: 'published', by: 'Aarav Kulkarni', at: '2024-07-15T08:00:00Z' },
]

const approvalHistoryReview: ApprovalStep[] = [
  { step: 'submitted', by: 'Aarav Kulkarni', at: '2024-08-18T09:00:00Z' },
  { step: 'reviewed', by: 'Dr. Meera Nair (HOD)', at: '2024-08-21T10:15:00Z', note: 'Awaiting Academic Council sign-off.' },
]

const approvalHistoryDraft: ApprovalStep[] = [
  { step: 'submitted', by: 'Aarav Kulkarni', at: '2024-08-20T09:00:00Z', note: 'Draft created, not yet submitted.' },
]

export const regulations: Regulation[] = [
  {
    id: 'reg-1',
    name: 'Academic Performance Policy 2024',
    code: 'AP-2024-001',
    version: '2.1',
    status: 'published',
    effectiveDate: '2024-01-01',
    lastModified: '2024-08-15',
    programId: 'prog-btcs',
    description: 'Governs minimum academic performance thresholds for continuation and honors eligibility.',
    versions: [
      { version: '2.1', changeSummary: 'Adjusted grace-mark cap from 5 to 8 marks.', changedBy: 'Aarav Kulkarni', changedAt: '2024-08-15' },
      { version: '2.0', changeSummary: 'Introduced CGPA-based promotion tiers.', changedBy: 'Aarav Kulkarni', changedAt: '2024-03-02' },
      { version: '1.0', changeSummary: 'Initial publication.', changedBy: 'Aarav Kulkarni', changedAt: '2024-01-01' },
    ],
    approvalHistory: approvalHistoryPublished,
  },
  {
    id: 'reg-2',
    name: 'Attendance Requirement',
    code: 'AR-2024-002',
    version: '1.5',
    status: 'draft',
    effectiveDate: '2024-09-01',
    lastModified: '2024-08-20',
    programId: 'prog-bte',
    description: 'Defines minimum attendance percentage required for exam eligibility, with medical condonation rules.',
    versions: [
      { version: '1.5', changeSummary: 'Added medical condonation clause.', changedBy: 'Aarav Kulkarni', changedAt: '2024-08-20' },
      { version: '1.0', changeSummary: 'Initial draft.', changedBy: 'Aarav Kulkarni', changedAt: '2024-06-01' },
    ],
    approvalHistory: approvalHistoryDraft,
  },
  {
    id: 'reg-3',
    name: 'Promotion and Continuation Policy',
    code: 'PC-2024-003',
    version: '3.0',
    status: 'published',
    effectiveDate: '2024-01-15',
    lastModified: '2024-07-10',
    programId: 'prog-btm',
    description: 'Rules for year-to-year promotion, backlog (ATKT) limits, and re-admission criteria.',
    versions: [
      { version: '3.0', changeSummary: 'Backlog cap raised from 3 to 4 subjects.', changedBy: 'Dr. Meera Nair', changedAt: '2024-07-10' },
    ],
    approvalHistory: approvalHistoryPublished,
  },
  {
    id: 'reg-4',
    name: 'Exception Handling Framework',
    code: 'EH-2024-004',
    version: '1.0',
    status: 'review',
    effectiveDate: '2024-10-01',
    lastModified: '2024-08-22',
    programId: 'prog-bce',
    description: 'Process for handling grace marks, appeals, and manual overrides to automated eligibility decisions.',
    versions: [
      { version: '1.0', changeSummary: 'Initial submission for council review.', changedBy: 'Aarav Kulkarni', changedAt: '2024-08-22' },
    ],
    approvalHistory: approvalHistoryReview,
  },
]

export const rules: Rule[] = [
  {
    id: 'rule-1',
    regulationId: 'reg-1',
    name: 'Minimum semester attendance',
    type: 'attendance',
    conditions: [{ id: 'c1', field: 'attendancePercent', operator: 'gte', value: '75' }],
    outcome: 'Eligible to sit for semester exams',
    active: true,
  },
  {
    id: 'rule-2',
    regulationId: 'reg-1',
    name: 'Minimum passing marks per subject',
    type: 'passing',
    conditions: [{ id: 'c2', field: 'subjectMarks', operator: 'gte', value: '40' }],
    outcome: 'Subject marked as passed',
    active: true,
  },
  {
    id: 'rule-3',
    regulationId: 'reg-1',
    name: 'Grace marks cap',
    type: 'grace_marks',
    conditions: [{ id: 'c3', field: 'shortfallMarks', operator: 'lte', value: '8' }],
    outcome: 'Up to 8 grace marks applied per subject',
    active: true,
  },
  {
    id: 'rule-4',
    regulationId: 'reg-3',
    name: 'Backlog limit for promotion',
    type: 'backlog',
    conditions: [{ id: 'c4', field: 'activeBacklogs', operator: 'lte', value: '4' }],
    outcome: 'Promoted to next year with active backlog',
    active: true,
  },
  {
    id: 'rule-5',
    regulationId: 'reg-3',
    name: 'CGPA threshold for promotion',
    type: 'promotion',
    conditions: [{ id: 'c5', field: 'cgpa', operator: 'gte', value: '5.0' }],
    outcome: 'Eligible for promotion to next academic year',
    active: true,
  },
  {
    id: 'rule-6',
    regulationId: 'reg-2',
    name: 'Attendance shortfall condonation',
    type: 'attendance',
    conditions: [
      { id: 'c6', field: 'attendancePercent', operator: 'gte', value: '65' },
      { id: 'c7', field: 'medicalCertificate', operator: 'eq', value: 'true' },
    ],
    outcome: 'Condoned to eligible with HOD approval',
    active: false,
  },
]

export const authUsers: AuthUser[] = [
  { id: 'user-1', name: 'Aarav Kulkarni', email: 'aarav.kulkarni@rulecraft.edu', role: 'super_admin', avatarInitials: 'AK' },
  { id: 'user-2', name: 'Dr. Meera Nair', email: 'meera.nair@rulecraft.edu', role: 'hod', department: 'Computer Science', avatarInitials: 'MN' },
  { id: 'user-3', name: 'Sanjay Verma', email: 'sanjay.verma@rulecraft.edu', role: 'faculty', department: 'Electronics', avatarInitials: 'SV' },
  { id: 'user-4', name: 'Rajesh Kumar', email: 'rajesh.kumar@university.edu', role: 'student', avatarInitials: 'RK' },
]

export const notifications: NotificationItem[] = [
  { id: 'notif-1', title: 'Regulation 2025.1 published', detail: 'Academic Council approved Academic Performance Policy 2024 v2.1.', time: '18 min ago', read: false, tone: 'teal' },
  { id: 'notif-2', title: 'New exception requires review', detail: 'B.Tech Computer Science — grace marks request pending.', time: '42 min ago', read: false, tone: 'coral' },
  { id: 'notif-3', title: 'Eligibility simulation completed', detail: 'Batch 2022 what-if run finished with 3 flagged students.', time: '1 hr ago', read: false, tone: 'blue' },
  { id: 'notif-4', title: 'Attendance Requirement moved to draft', detail: 'Version 1.5 saved by Aarav Kulkarni.', time: '3 hrs ago', read: true, tone: 'amber' },
  { id: 'notif-5', title: 'Weekly digest ready', detail: '186 rules active across 5 programs.', time: 'Yesterday', read: true, tone: 'blue' },
]

export const aiWelcomeMessages: AiMessage[] = [
  {
    id: 'ai-1',
    role: 'assistant',
    content:
      "Hi, I'm the RuleCraft AI assistant. Describe a rule in plain English and I'll draft it, or ask me to explain an eligibility result. I never make the final decision myself — the rule engine always does.",
    at: new Date().toISOString(),
  },
]

export const simulationResults: SimulationResult[] = [
  {
    id: 'sim-1',
    studentId: 'stu-4',
    studentName: 'Arjun Singh',
    regulationId: 'reg-3',
    ranAt: '2024-08-23T10:00:00Z',
    outcome: 'not_eligible',
    breakdown: [
      { rule: 'Backlog limit for promotion', passed: false, detail: '5 active backlogs, limit is 4.' },
      { rule: 'CGPA threshold for promotion', passed: false, detail: 'CGPA 2.1, requires 5.0.' },
    ],
  },
]

// Simple id generator for mock create actions — good enough for a frontend
// that isn't yet backed by a real database.
export function nextId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

export function programName(programId: string) {
  return programs.find((p) => p.id === programId)?.name ?? 'Unknown program'
}

export function departmentName(departmentId: string) {
  return departments.find((d) => d.id === departmentId)?.name ?? 'Unknown department'
}
