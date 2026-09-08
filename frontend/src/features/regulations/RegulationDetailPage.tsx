import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Archive,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Edit2,
  FileText,
  GitCommitHorizontal,
  History,
  Loader2,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import Modal from '@/components/ui/Modal'
import StatusBadge from '@/components/ui/StatusBadge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import * as regulationsApi from '@/api/regulations'
import * as rulesApi from '@/api/rules'
import * as programsApi from '@/api/programs'
import { ApiRequestError } from '@/api/client'
import { describeConditionTree } from '@/utils/conditionTree'
import type { RegulationWithRuleCount } from '@/api/regulations'
import type { Program, RegulationVersionDiff, Rule, RuleAuditEntry, RuleConflict } from '@/types'

const allTabs = ['Overview', 'Rules', 'Version history', 'Approval workflow', 'Rule activity'] as const
type Tab = (typeof allTabs)[number]

const ruleActionMeta: Record<string, { label: string; icon: typeof History; tone: string }> = {
  'rule.created': { label: 'Created', icon: Plus, tone: 'bg-[#dcfce7] text-[#16a34a]' },
  'rule.updated': { label: 'Edited', icon: Edit2, tone: 'bg-[#e0e7ff] text-[#4f46e5]' },
  'rule.activated': { label: 'Activated', icon: CheckCircle2, tone: 'bg-[#dcfce7] text-[#16a34a]' },
  'rule.deactivated': { label: 'Deactivated', icon: XCircle, tone: 'bg-[#f1f5f9] text-[#475569]' },
  'rule.deleted': { label: 'Deleted', icon: Trash2, tone: 'bg-[#fee2e2] text-[#dc2626]' },
}

const REJECT_NOTE = 'Rejected — returned to draft for revisions.'

export default function RegulationDetailPage() {
  const { regulationId } = useParams()
  const { showToast } = useToast()
  const { user } = useAuth()
  const canManage = user?.role === 'super_admin' || user?.role === 'registrar'
  const canApprove = user?.role === 'super_admin'
  const canReject = user?.role === 'super_admin' || user?.role === 'hod'
  const canViewRuleActivity = user?.role === 'super_admin' || user?.role === 'registrar' || user?.role === 'hod'
  const visibleTabs = canViewRuleActivity ? allTabs : allTabs.filter((t) => t !== 'Rule activity')

  const [regulation, setRegulation] = useState<RegulationWithRuleCount | null>(null)
  const [regulationRules, setRegulationRules] = useState<Rule[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionPending, setActionPending] = useState(false)

  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [confirmAction, setConfirmAction] = useState<'reject' | 'archive' | null>(null)

  const [ruleAudit, setRuleAudit] = useState<RuleAuditEntry[] | null>(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState('')

  const [checkingConflicts, setCheckingConflicts] = useState(false)
  const [conflictModalOpen, setConflictModalOpen] = useState(false)
  const [pendingConflicts, setPendingConflicts] = useState<RuleConflict[]>([])

  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([])
  const [diffModalOpen, setDiffModalOpen] = useState(false)
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffError, setDiffError] = useState('')
  const [versionDiff, setVersionDiff] = useState<RegulationVersionDiff | null>(null)

  async function loadData() {
    if (!regulationId) return
    setLoading(true)
    setLoadError('')
    setNotFound(false)
    try {
      const [reg, ruleRows, progs] = await Promise.all([
        regulationsApi.getById(regulationId),
        rulesApi.list({ regulationId }),
        programsApi.list(),
      ])
      setRegulation(reg)
      setRegulationRules(ruleRows)
      setPrograms(progs)
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 404) {
        setNotFound(true)
      } else {
        setLoadError(err instanceof ApiRequestError ? err.message : 'Failed to load this regulation.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regulationId])

  useEffect(() => {
    if (activeTab !== 'Rule activity' || ruleAudit !== null || !regulationId) return
    setAuditLoading(true)
    setAuditError('')
    regulationsApi
      .getRuleAuditHistory(regulationId)
      .then(setRuleAudit)
      .catch((err) => setAuditError(err instanceof ApiRequestError ? err.message : 'Failed to load rule activity.'))
      .finally(() => setAuditLoading(false))
  }, [activeTab, ruleAudit, regulationId])

  const programName = useMemo(
    () => programs.find((p) => p.id === regulation?.programId)?.name ?? 'Unknown program',
    [programs, regulation],
  )

  if (notFound) return <Navigate to="/regulations" replace />

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[#475569]" size={28} />
      </div>
    )
  }

  if (loadError || !regulation) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 pb-10 pt-8 sm:px-9 lg:px-12">
        <Link to="/regulations" className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-[#475569] hover:text-[#0f172a]">
          <ArrowLeft size={14} /> Back to regulations
        </Link>
        <EmptyState
          icon={AlertCircle}
          title="Couldn't load this regulation"
          description={loadError || 'Something went wrong.'}
          action={{ label: 'Retry', onClick: loadData }}
        />
      </div>
    )
  }

  async function runAction(action: () => Promise<RegulationWithRuleCount>, successMessage: string) {
    setActionPending(true)
    try {
      const updated = await action()
      setRegulation(updated)
      showToast(successMessage)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Action failed.', 'error')
    } finally {
      setActionPending(false)
    }
  }

  async function attemptPublish() {
    if (!regulation) return
    setCheckingConflicts(true)
    try {
      const conflicts = await regulationsApi.getConflicts(regulation.id)
      if (conflicts.length > 0) {
        setPendingConflicts(conflicts)
        setConflictModalOpen(true)
        return
      }
      await runAction(() => regulationsApi.approve(regulation.id), `${regulation.name} approved and published.`)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to check rule conflicts.', 'error')
    } finally {
      setCheckingConflicts(false)
    }
  }

  function publishDespiteConflicts() {
    if (!regulation) return
    setConflictModalOpen(false)
    runAction(() => regulationsApi.approve(regulation.id), `${regulation.name} approved and published (conflicts acknowledged).`)
  }

  function toggleVersionSelect(id: string) {
    setSelectedVersionIds((prev) => {
      if (prev.includes(id)) return prev.filter((v) => v !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  async function compareVersions() {
    if (!regulation || selectedVersionIds.length !== 2) return
    // regulation.versions is already ordered newest-first by the backend
    // using full timestamp precision — sort by that array position, not by
    // re-parsing changedAt (a date-only display string), which collides
    // whenever two versions were created on the same calendar day.
    const [idA, idB] = selectedVersionIds
    const indexA = regulation.versions.findIndex((v) => v.id === idA)
    const indexB = regulation.versions.findIndex((v) => v.id === idB)
    const [newer, older] = indexA <= indexB ? [regulation.versions[indexA], regulation.versions[indexB]] : [regulation.versions[indexB], regulation.versions[indexA]]
    setDiffLoading(true)
    setDiffError('')
    setVersionDiff(null)
    setDiffModalOpen(true)
    try {
      setVersionDiff(await regulationsApi.getVersionDiff(regulation.id, older.id, newer.id))
    } catch (err) {
      setDiffError(err instanceof ApiRequestError ? err.message : 'Failed to compare versions.')
    } finally {
      setDiffLoading(false)
    }
  }

  async function duplicateRegulation() {
    if (!regulation) return
    setActionPending(true)
    try {
      const copy = await regulationsApi.duplicate(regulation.id)
      showToast(`Duplicated as "${copy.name}".`)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to duplicate regulation.', 'error')
    } finally {
      setActionPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-10 pt-8 sm:px-9 lg:px-12">
      <Link to="/regulations" className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-[#475569] hover:text-[#0f172a]">
        <ArrowLeft size={14} /> Back to regulations
      </Link>

      <div className="mb-8 flex flex-col justify-between gap-4 border border-[#e2e8f0] bg-[#ffffff] p-6 sm:flex-row sm:items-start">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-[#0f172a]">{regulation.name}</h1>
            <StatusBadge status={regulation.status} />
          </div>
          <p className="text-xs text-[#94a3b8]">
            Code: <span className="font-mono font-semibold">{regulation.code}</span> · Version {regulation.version} ·{' '}
            {programName}
          </p>
          <p className="mt-3 max-w-2xl text-sm text-[#475569]">{regulation.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {regulation.status === 'draft' && canManage && (
            <button
              disabled={actionPending}
              onClick={() => runAction(() => regulationsApi.submit(regulation.id), `${regulation.name} moved to review.`)}
              className="flex items-center gap-2 rounded-lg bg-[#0f172a] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
            >
              <Send size={14} /> Submit for review
            </button>
          )}
          {regulation.status === 'review' && canApprove && (
            <button
              disabled={actionPending || checkingConflicts}
              onClick={attemptPublish}
              className="flex items-center gap-2 rounded-lg bg-[#16a34a] px-3 py-2 text-xs font-semibold text-white hover:bg-[#15803d] disabled:opacity-60"
            >
              {actionPending || checkingConflicts ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              Approve &amp; publish
            </button>
          )}
          {regulation.status === 'review' && canReject && (
            <button
              disabled={actionPending}
              onClick={() => setConfirmAction('reject')}
              className="flex items-center gap-2 rounded-lg border border-[#dc2626] px-3 py-2 text-xs font-semibold text-[#dc2626] hover:bg-[#fee2e2] disabled:opacity-60"
            >
              <XCircle size={14} /> Reject
            </button>
          )}
          {canManage && (
            <button
              disabled={actionPending}
              onClick={duplicateRegulation}
              className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] px-3 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-60"
            >
              <Copy size={14} /> Duplicate
            </button>
          )}
          {regulation.status !== 'archived' && canManage && (
            <button
              disabled={actionPending}
              onClick={() => setConfirmAction('archive')}
              className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] px-3 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-60"
            >
              <Archive size={14} /> Archive
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 flex gap-1 border-b border-[#e2e8f0]">
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-semibold transition ${
              activeTab === tab ? 'border-b-2 border-[#0f172a] text-[#0f172a]' : 'text-[#64748b] hover:text-[#475569]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="border border-[#e2e8f0] bg-[#ffffff] p-4">
            <p className="text-xs font-semibold text-[#64748b]">Effective date</p>
            <p className="mt-2 font-display text-lg font-bold text-[#0f172a]">{regulation.effectiveDate}</p>
          </div>
          <div className="border border-[#e2e8f0] bg-[#ffffff] p-4">
            <p className="text-xs font-semibold text-[#64748b]">Last modified</p>
            <p className="mt-2 font-display text-lg font-bold text-[#0f172a]">{regulation.lastModified}</p>
          </div>
          <div className="border border-[#e2e8f0] bg-[#ffffff] p-4">
            <p className="text-xs font-semibold text-[#64748b]">Active rules</p>
            <p className="mt-2 font-display text-lg font-bold text-[#0f172a]">
              {regulationRules.filter((r) => r.active).length} / {regulationRules.length}
            </p>
          </div>
        </div>
      )}

      {activeTab === 'Rules' && (
        <div className="space-y-3">
          {regulationRules.length === 0 ? (
            <div className="border border-dashed border-[#cbd5e1] bg-[#ffffff] py-10 text-center text-sm text-[#94a3b8]">
              No rules attached yet.{' '}
              <Link to="/rule-engine" className="font-semibold text-[#4f46e5]">
                Build one in the rule engine.
              </Link>
            </div>
          ) : (
            regulationRules.map((rule) => (
              <div key={rule.id} className="border border-[#e2e8f0] bg-[#ffffff] p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#0f172a]">{rule.name}</p>
                  <StatusBadge status={rule.active ? 'active' : 'draft'} label={rule.active ? 'active' : 'inactive'} />
                </div>
                <p className="mt-1 text-xs uppercase tracking-wide text-[#94a3b8]">{rule.type.replace('_', ' ')}</p>
                <p className="mt-2 text-xs text-[#64748b]">
                  {describeConditionTree(rule.conditionTree)} → {rule.outcome}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'Version history' && (
        <div>
          {regulation.versions.length >= 2 && (
            <div className="mb-3 flex items-center justify-between border border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5 text-xs">
              <span className="font-semibold text-[#475569]">
                {selectedVersionIds.length === 0 ? 'Select two versions to compare' : `${selectedVersionIds.length} of 2 selected`}
              </span>
              <button
                onClick={compareVersions}
                disabled={selectedVersionIds.length !== 2}
                className="rounded-lg bg-[#0f172a] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Compare selected
              </button>
            </div>
          )}
          <div className="space-y-3">
            {regulation.versions.map((v) => (
              <div
                key={v.id}
                className={`flex gap-4 border p-4 ${selectedVersionIds.includes(v.id) ? 'border-[#4f46e5] bg-[#eef2ff]' : 'border-[#e2e8f0] bg-[#ffffff]'}`}
              >
                {regulation.versions.length >= 2 && (
                  <input
                    type="checkbox"
                    checked={selectedVersionIds.includes(v.id)}
                    onChange={() => toggleVersionSelect(v.id)}
                    aria-label={`Select version ${v.version} for comparison`}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#4f46e5]"
                  />
                )}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[#475569]">
                  <GitCommitHorizontal size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#0f172a]">
                    v{v.version} <span className="font-normal text-[#94a3b8]">· {v.changedAt}</span>
                    {!v.hasSnapshot && (
                      <span className="ml-2 rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#94a3b8]">
                        No snapshot
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-[#64748b]">{v.changeSummary}</p>
                  <p className="mt-1 text-[10px] text-[#94a3b8]">by {v.changedBy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Approval workflow' && (
        <div className="space-y-3">
          {regulation.approvalHistory.map((step, index) => (
            <div key={index} className="flex gap-4 border border-[#e2e8f0] bg-[#ffffff] p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#dcfce7] text-[#16a34a]">
                {step.step === 'rejected' ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
              </div>
              <div>
                <p className="text-sm font-semibold capitalize text-[#0f172a]">{step.step.replace('_', ' ')}</p>
                <p className="mt-1 text-xs text-[#64748b]">by {step.by} · {new Date(step.at).toLocaleString()}</p>
                {step.note && <p className="mt-1 flex items-center gap-1 text-xs text-[#94a3b8]"><FileText size={12} /> {step.note}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Rule activity' && (
        <div>
          {auditLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-[#475569]" size={24} />
            </div>
          ) : auditError ? (
            <EmptyState
              icon={AlertCircle}
              title="Couldn't load rule activity"
              description={auditError}
              action={{ label: 'Retry', onClick: () => setRuleAudit(null) }}
            />
          ) : !ruleAudit || ruleAudit.length === 0 ? (
            <EmptyState
              icon={History}
              title="No rule activity yet"
              description="Creating, editing, activating, or deleting one of this regulation's rules will show up here with who did it and when."
            />
          ) : (
            <div className="space-y-3">
              {ruleAudit.map((entry) => {
                const meta = ruleActionMeta[entry.action] ?? { label: entry.action, icon: History, tone: 'bg-[#f1f5f9] text-[#475569]' }
                const Icon = meta.icon
                return (
                  <div key={entry.id} className="flex gap-4 border border-[#e2e8f0] bg-[#ffffff] p-4">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                      <Icon size={15} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0f172a]">
                        {meta.label} <span className="font-normal text-[#94a3b8]">· {entry.ruleName}</span>
                      </p>
                      <p className="mt-1 text-xs text-[#64748b]">
                        by {entry.byName} · {new Date(entry.at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmAction === 'reject'}
        title="Reject regulation"
        description={`Reject ${regulation.name} and send it back to draft?`}
        confirmLabel="Reject"
        onConfirm={() => {
          setConfirmAction(null)
          runAction(() => regulationsApi.reject(regulation.id, REJECT_NOTE), `${regulation.name} moved to draft.`)
        }}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === 'archive'}
        title="Archive regulation"
        description={`Archive ${regulation.name}? It will no longer apply to new eligibility checks.`}
        confirmLabel="Archive"
        onConfirm={() => {
          setConfirmAction(null)
          runAction(() => regulationsApi.archive(regulation.id), `${regulation.name} moved to archived.`)
        }}
        onCancel={() => setConfirmAction(null)}
      />

      <Modal
        open={conflictModalOpen}
        title="Rule conflicts detected"
        description="Found before publishing — review these before deciding whether to proceed."
        onClose={() => setConflictModalOpen(false)}
        widthClassName="max-w-lg"
      >
        <div className="mb-4 flex items-start gap-2 border-l-4 border-[#f59e0b] bg-[#fffbeb] p-3 text-xs font-semibold text-[#92400e]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          This is a heuristic check, not a mathematically complete solver — it catches common same-field
          contradictions (incompatible numeric bounds, conflicting equality checks) but can't prove two rules are
          conflict-free in general. A clean result here isn't a guarantee; review the items below either way.
        </div>
        <div className="mb-4 max-h-72 space-y-2 overflow-y-auto">
          {pendingConflicts.map((c, i) => (
            <div key={i} className="border border-[#fee2e2] bg-[#fef2f2] p-3 text-xs">
              <p className="font-semibold text-[#0f172a]">
                {c.ruleAId === c.ruleBId ? c.ruleAName : `${c.ruleAName} ↔ ${c.ruleBName}`}
              </p>
              <p className="mt-1 text-[#7f1d1d]">{c.description}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setConflictModalOpen(false)}
            className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9]"
          >
            Cancel
          </button>
          <button
            onClick={publishDespiteConflicts}
            className="rounded-lg bg-[#f59e0b] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#d97706]"
          >
            Acknowledge and publish anyway
          </button>
        </div>
      </Modal>

      <Modal open={diffModalOpen} title="Compare versions" onClose={() => setDiffModalOpen(false)} widthClassName="max-w-2xl">
        {diffLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-[#475569]" size={24} />
          </div>
        ) : diffError ? (
          <p className="text-xs font-semibold text-[#dc2626]">{diffError}</p>
        ) : versionDiff ? (
          <div>
            <p className="mb-4 text-xs text-[#64748b]">
              Comparing v{versionDiff.versionA.version} ({new Date(versionDiff.versionA.changedAt).toLocaleDateString()}) → v
              {versionDiff.versionB.version} ({new Date(versionDiff.versionB.changedAt).toLocaleDateString()})
            </p>
            {!versionDiff.versionA.hasSnapshot || !versionDiff.versionB.hasSnapshot ? (
              <EmptyState
                icon={AlertCircle}
                title="No snapshot to compare"
                description="One or both of these versions were created before version snapshots existed, so there's nothing captured to diff. Versions created from now on support full comparison."
              />
            ) : versionDiff.metadataChanges.length === 0 &&
              versionDiff.rulesAdded.length === 0 &&
              versionDiff.rulesRemoved.length === 0 &&
              versionDiff.rulesChanged.length === 0 ? (
              <p className="text-xs text-[#94a3b8]">No differences found between these two versions.</p>
            ) : (
              <div className="max-h-[60vh] space-y-5 overflow-y-auto">
                {versionDiff.metadataChanges.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#475569]">Metadata changes</p>
                    <div className="space-y-2">
                      {versionDiff.metadataChanges.map((m, i) => (
                        <div key={i} className="border border-[#e2e8f0] p-3 text-xs">
                          <p className="font-semibold text-[#0f172a]">{m.field}</p>
                          <p className="mt-1 text-[#dc2626] line-through">{m.from}</p>
                          <p className="mt-1 text-[#16a34a]">{m.to}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {versionDiff.rulesAdded.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#16a34a]">Rules added</p>
                    <div className="space-y-2">
                      {versionDiff.rulesAdded.map((r) => (
                        <div key={r.id} className="border border-[#dcfce7] bg-[#f0fdf4] p-3 text-xs">
                          <p className="font-semibold text-[#0f172a]">{r.name}</p>
                          <p className="mt-1 text-[#475569]">
                            {r.conditionSummary} → {r.outcome}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {versionDiff.rulesRemoved.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#dc2626]">Rules removed</p>
                    <div className="space-y-2">
                      {versionDiff.rulesRemoved.map((r) => (
                        <div key={r.id} className="border border-[#fee2e2] bg-[#fef2f2] p-3 text-xs">
                          <p className="font-semibold text-[#0f172a]">{r.name}</p>
                          <p className="mt-1 text-[#475569]">
                            {r.conditionSummary} → {r.outcome}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {versionDiff.rulesChanged.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#4f46e5]">Rules changed</p>
                    <div className="space-y-2">
                      {versionDiff.rulesChanged.map((r) => (
                        <div key={r.id} className="border border-[#e0e7ff] bg-[#eef2ff] p-3 text-xs">
                          <p className="font-semibold text-[#0f172a]">{r.name}</p>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[#475569]">
                            {r.changes.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
