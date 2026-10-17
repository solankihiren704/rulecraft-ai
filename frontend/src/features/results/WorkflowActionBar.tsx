import { useState } from 'react'
import {
  FileCheck,
  Send,
  CheckCircle,
  Globe,
  RotateCcw,
  History,
  Loader2,
  ChevronDown,
  Clock,
  ShieldAlert,
} from 'lucide-react'
import type { ResultWorkflowRecord, ResultWorkflowStatus } from '@/api/students'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import * as studentsApi from '@/api/students'

interface WorkflowActionBarProps {
  workflow: ResultWorkflowRecord | null
  onWorkflowUpdated: (updated: ResultWorkflowRecord) => void
}

const statusConfig: Record<
  ResultWorkflowStatus,
  { label: string; bg: string; text: string; border: string; icon: typeof FileCheck }
> = {
  draft: {
    label: 'DRAFT MARKS ENTRY',
    bg: 'bg-[#f1f5f9]',
    text: 'text-[#475569]',
    border: 'border-[#cbd5e1]',
    icon: FileCheck,
  },
  under_review: {
    label: 'UNDER HOD MODERATION',
    bg: 'bg-[#fef3c7]',
    text: 'text-[#b45309]',
    border: 'border-[#fde68a]',
    icon: Clock,
  },
  approved: {
    label: 'APPROVED BY HOD',
    bg: 'bg-[#e0e7ff]',
    text: 'text-[#4338ca]',
    border: 'border-[#c7d2fe]',
    icon: CheckCircle,
  },
  published: {
    label: 'OFFICIALLY PUBLISHED',
    bg: 'bg-[#dcfce7]',
    text: 'text-[#15803d]',
    border: 'border-[#bbf7d0]',
    icon: Globe,
  },
}

export default function WorkflowActionBar({ workflow, onWorkflowUpdated }: WorkflowActionBarProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  if (!workflow || !user || user.role === 'student') {
    return null
  }

  const cfg = statusConfig[workflow.status] ?? statusConfig.draft
  const StatusIcon = cfg.icon

  const canSubmit = (user.role === 'faculty' || user.role === 'hod' || user.role === 'registrar' || user.role === 'super_admin') && workflow.status === 'draft'
  const canApprove = (user.role === 'hod' || user.role === 'registrar' || user.role === 'super_admin') && workflow.status === 'under_review'
  const canPublish = (user.role === 'registrar' || user.role === 'super_admin') && workflow.status !== 'published'
  const canRevert = (user.role === 'hod' || user.role === 'registrar' || user.role === 'super_admin') && workflow.status !== 'draft'

  async function handleTransition(action: 'submit' | 'approve' | 'publish' | 'revert') {
    setLoading(true)
    try {
      const res = await studentsApi.transitionWorkflow({
        programId: workflow?.programId || 'all',
        action,
      })
      onWorkflowUpdated(res)
      showToast(`Lifecycle status updated to ${res.status.toUpperCase()}.`)
    } catch {
      showToast('Failed to update result workflow status.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#cbd5e1] bg-white p-4 shadow-xs">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Status indicator */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0f172a] text-white shadow-xs">
            <StatusIcon size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                {cfg.label}
              </span>
              <span className="text-xs text-[#94a3b8]">•</span>
              <span className="text-xs font-semibold text-[#64748b]">{workflow.semesterName}</span>
            </div>
            <p className="mt-0.5 text-xs text-[#475569]">
              Last updated by <span className="font-semibold text-[#0f172a]">{workflow.updatedBy}</span> ({new Date(workflow.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {canSubmit && (
            <button
              onClick={() => handleTransition('submit')}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4338ca] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#3730a3]"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span>Submit for Moderation</span>
            </button>
          )}

          {canApprove && (
            <button
              onClick={() => handleTransition('approve')}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#16a34a] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#15803d]"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              <span>Approve Moderated Marks</span>
            </button>
          )}

          {canPublish && (
            <button
              onClick={() => handleTransition('publish')}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f172a] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1e293b]"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
              <span>Publish to Students</span>
            </button>
          )}

          {canRevert && (
            <button
              onClick={() => handleTransition('revert')}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f8fafc]"
              title="Roll back status"
            >
              <RotateCcw size={13} />
              <span>Roll Back</span>
            </button>
          )}

          {/* Toggle History Dropdown */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-[#334155] hover:bg-[#f1f5f9]"
          >
            <History size={14} />
            <span>Audit Trail ({workflow.history?.length || 0})</span>
            <ChevronDown size={13} className={showHistory ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
        </div>
      </div>

      {/* History Drawer */}
      {showHistory && (
        <div className="mt-4 border-t border-[#e2e8f0] pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#475569]">
            Result Publishing Lifecycle Timeline
          </h4>
          <div className="mt-2 divide-y divide-[#f1f5f9] rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-2">
            {workflow.history && workflow.history.length > 0 ? (
              workflow.history.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#0f172a]">{h.byUser}</span>
                    <span className="rounded bg-[#e2e8f0] px-1.5 py-0.2 text-[10px] uppercase font-bold text-[#475569]">
                      {h.byRole}
                    </span>
                    <span className="text-[#64748b]">transitioned status to</span>
                    <span className="font-bold uppercase text-[#4338ca]">{h.toStatus}</span>
                  </div>
                  <span className="text-[11px] text-[#94a3b8]">
                    {new Date(h.at).toLocaleDateString()} {new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            ) : (
              <p className="p-3 text-center text-xs text-[#94a3b8]">No prior transitions recorded.</p>
            )}
          </div>
        </div>
      )}

      {/* Student View Warning Notice if Unpublished */}
      {workflow.status !== 'published' && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#fffbeb] p-2.5 text-xs text-[#92400e]">
          <ShieldAlert size={16} className="shrink-0 text-[#f59e0b]" />
          <span>
            <strong className="font-semibold">Notice:</strong> Results are currently in <strong>{cfg.label}</strong> mode. Students logging into the portal will see an official under-moderation notice until you click &quot;Publish to Students&quot;.
          </span>
        </div>
      )}
    </div>
  )
}
