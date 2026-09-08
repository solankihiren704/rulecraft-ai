import type { AiMessage, AuthUser, NotificationItem, SimulationResult } from '@/types'

// Centralized mock data (Phase 1 — no backend yet). Remaining consumers are
// the pieces that still don't have a backend module (AI assistant,
// notifications) — everything else now reads from the real API.

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
