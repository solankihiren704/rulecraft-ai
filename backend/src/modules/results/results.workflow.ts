import fs from 'node:fs'
import path from 'node:path'
import { ApiError } from '@/middleware/errorHandler'
import type { Role } from '@/types'

export type ResultWorkflowStatus = 'draft' | 'under_review' | 'approved' | 'published'

export interface WorkflowHistoryItem {
  id: string
  fromStatus: ResultWorkflowStatus
  toStatus: ResultWorkflowStatus
  action: 'submit' | 'approve' | 'publish' | 'revert'
  byUser: string
  byRole: Role
  at: string
  notes?: string
}

export interface ResultWorkflowRecord {
  key: string
  programId: string
  semesterName: string
  status: ResultWorkflowStatus
  updatedAt: string
  updatedBy: string
  updatedByRole: Role
  notes?: string
  history: WorkflowHistoryItem[]
}

interface CurrentUser {
  id: string
  role: Role
  departmentId: string | null
  name?: string
}

const DATA_DIR = path.resolve(process.cwd(), 'data')
const STATE_FILE = path.join(DATA_DIR, 'result_workflow_state.json')

function ensureStorage(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!fs.existsSync(STATE_FILE)) {
    // Initial state: published by default so initial students have results,
    // but administrators can transition and test all workflow states anytime.
    const initial: Record<string, ResultWorkflowRecord> = {
      default: {
        key: 'default',
        programId: 'all',
        semesterName: 'All Semesters',
        status: 'published',
        updatedAt: new Date().toISOString(),
        updatedBy: 'University Registrar',
        updatedByRole: 'registrar',
        notes: 'Official academic results released for current academic year.',
        history: [
          {
            id: 'init-1',
            fromStatus: 'draft',
            toStatus: 'under_review',
            action: 'submit',
            byUser: 'Faculty Examination Committee',
            byRole: 'faculty',
            at: new Date(Date.now() - 86400000 * 3).toISOString(),
            notes: 'Semester marks compiled and verified.',
          },
          {
            id: 'init-2',
            fromStatus: 'under_review',
            toStatus: 'approved',
            action: 'approve',
            byUser: 'Head of Department',
            byRole: 'hod',
            at: new Date(Date.now() - 86400000 * 2).toISOString(),
            notes: 'Department moderation completed.',
          },
          {
            id: 'init-3',
            fromStatus: 'approved',
            toStatus: 'published',
            action: 'publish',
            byUser: 'Neha Iyer (Registrar)',
            byRole: 'registrar',
            at: new Date(Date.now() - 86400000).toISOString(),
            notes: 'Published officially for student access.',
          },
        ],
      },
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(initial, null, 2), 'utf-8')
  }
}

function readState(): Record<string, ResultWorkflowRecord> {
  ensureStorage()
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeState(data: Record<string, ResultWorkflowRecord>): void {
  ensureStorage()
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

export function getWorkflowStatus(programId = 'all'): ResultWorkflowRecord {
  const state = readState()
  return (
    state[programId] ??
    state.default ?? {
      key: programId,
      programId,
      semesterName: 'All Semesters',
      status: 'published',
      updatedAt: new Date().toISOString(),
      updatedBy: 'System',
      updatedByRole: 'registrar',
      history: [],
    }
  )
}

export function transitionWorkflow(input: {
  programId?: string
  action: 'submit' | 'approve' | 'publish' | 'revert'
  notes?: string
  user: CurrentUser
}): ResultWorkflowRecord {
  const { programId = 'all', action, notes, user } = input
  const state = readState()
  const current = getWorkflowStatus(programId)

  let nextStatus: ResultWorkflowStatus = current.status

  switch (action) {
    case 'submit': {
      if (user.role !== 'faculty' && user.role !== 'hod' && user.role !== 'registrar' && user.role !== 'super_admin') {
        throw new ApiError(403, 'You do not have permission to submit results for moderation.')
      }
      nextStatus = 'under_review'
      break
    }
    case 'approve': {
      if (user.role !== 'hod' && user.role !== 'registrar' && user.role !== 'super_admin') {
        throw new ApiError(403, 'Only HOD or higher can approve moderated results.')
      }
      nextStatus = 'approved'
      break
    }
    case 'publish': {
      if (user.role !== 'registrar' && user.role !== 'super_admin') {
        throw new ApiError(403, 'Only the Registrar or Super Admin can officially publish results.')
      }
      nextStatus = 'published'
      break
    }
    case 'revert': {
      if (user.role !== 'hod' && user.role !== 'registrar' && user.role !== 'super_admin') {
        throw new ApiError(403, 'You do not have permission to revert result status.')
      }
      nextStatus = current.status === 'published' ? 'approved' : current.status === 'approved' ? 'under_review' : 'draft'
      break
    }
  }

  const actorName = user.name || `${user.role.toUpperCase()} (${user.id.slice(0, 6)})`

  const historyItem: WorkflowHistoryItem = {
    id: `wf-${Date.now().toString(36)}`,
    fromStatus: current.status,
    toStatus: nextStatus,
    action,
    byUser: actorName,
    byRole: user.role,
    at: new Date().toISOString(),
    notes: notes || undefined,
  }

  const updated: ResultWorkflowRecord = {
    key: programId,
    programId,
    semesterName: current.semesterName || 'All Semesters',
    status: nextStatus,
    updatedAt: new Date().toISOString(),
    updatedBy: actorName,
    updatedByRole: user.role,
    notes: notes || current.notes,
    history: [historyItem, ...(current.history || [])],
  }

  state[programId] = updated
  if (programId === 'all') {
    state.default = updated
  }
  writeState(state)

  return updated
}
