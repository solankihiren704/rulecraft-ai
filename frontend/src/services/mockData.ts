import type { AiMessage, AuthUser, Department, NotificationItem, Program, Semester, SimulationResult, Student, Subject } from '@/types'

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
