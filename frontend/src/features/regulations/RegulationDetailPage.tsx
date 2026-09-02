import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Archive,
  AlertCircle,
  CheckCircle2,
  Copy,
  FileText,
  GitCommitHorizontal,
  Loader2,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import StatusBadge from '@/components/ui/StatusBadge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import * as regulationsApi from '@/api/regulations'
import * as rulesApi from '@/api/rules'
import * as programsApi from '@/api/programs'
import { ApiRequestError } from '@/api/client'
import type { RegulationWithRuleCount } from '@/api/regulations'
import type { Program, Rule } from '@/types'

const tabs = ['Overview', 'Rules', 'Version history', 'Approval workflow'] as const
type Tab = (typeof tabs)[number]

const REJECT_NOTE = 'Rejected — returned to draft for revisions.'

export default function RegulationDetailPage() {
  const { regulationId } = useParams()
  const { showToast } = useToast()
  const { user } = useAuth()
  const canManage = user?.role === 'super_admin' || user?.role === 'registrar'
  const canApprove = user?.role === 'super_admin'
  const canReject = user?.role === 'super_admin' || user?.role === 'hod'

  const [regulation, setRegulation] = useState<RegulationWithRuleCount | null>(null)
  const [regulationRules, setRegulationRules] = useState<Rule[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionPending, setActionPending] = useState(false)

  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [confirmAction, setConfirmAction] = useState<'reject' | 'archive' | null>(null)

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

  const programName = useMemo(
    () => programs.find((p) => p.id === regulation?.programId)?.name ?? 'Unknown program',
    [programs, regulation],
  )

  if (notFound) return <Navigate to="/regulations" replace />

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[#557071]" size={28} />
      </div>
    )
  }

  if (loadError || !regulation) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 pb-10 pt-8 sm:px-9 lg:px-12">
        <Link to="/regulations" className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-[#557071] hover:text-[#173640]">
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
      <Link to="/regulations" className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-[#557071] hover:text-[#173640]">
        <ArrowLeft size={14} /> Back to regulations
      </Link>

      <div className="mb-8 flex flex-col justify-between gap-4 border border-[#e4e1da] bg-[#fbfaf7] p-6 sm:flex-row sm:items-start">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-[#102b35]">{regulation.name}</h1>
            <StatusBadge status={regulation.status} />
          </div>
          <p className="text-xs text-[#9aa8a5]">
            Code: <span className="font-mono font-semibold">{regulation.code}</span> · Version {regulation.version} ·{' '}
            {programName}
          </p>
          <p className="mt-3 max-w-2xl text-sm text-[#486362]">{regulation.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {regulation.status === 'draft' && canManage && (
            <button
              disabled={actionPending}
              onClick={() => runAction(() => regulationsApi.submit(regulation.id), `${regulation.name} moved to review.`)}
              className="flex items-center gap-2 rounded-lg bg-[#102b35] px-3 py-2 text-xs font-semibold text-white hover:bg-[#204853] disabled:opacity-60"
            >
              <Send size={14} /> Submit for review
            </button>
          )}
          {regulation.status === 'review' && canApprove && (
            <button
              disabled={actionPending}
              onClick={() => runAction(() => regulationsApi.approve(regulation.id), `${regulation.name} approved and published.`)}
              className="flex items-center gap-2 rounded-lg bg-[#087f72] px-3 py-2 text-xs font-semibold text-white hover:bg-[#066a5f] disabled:opacity-60"
            >
              <ShieldCheck size={14} /> Approve &amp; publish
            </button>
          )}
          {regulation.status === 'review' && canReject && (
            <button
              disabled={actionPending}
              onClick={() => setConfirmAction('reject')}
              className="flex items-center gap-2 rounded-lg border border-[#b94e37] px-3 py-2 text-xs font-semibold text-[#b94e37] hover:bg-[#ffe1d8] disabled:opacity-60"
            >
              <XCircle size={14} /> Reject
            </button>
          )}
          {canManage && (
            <button
              disabled={actionPending}
              onClick={duplicateRegulation}
              className="flex items-center gap-2 rounded-lg border border-[#e4e1da] px-3 py-2 text-xs font-semibold text-[#486362] hover:bg-[#f0eee8] disabled:opacity-60"
            >
              <Copy size={14} /> Duplicate
            </button>
          )}
          {regulation.status !== 'archived' && canManage && (
            <button
              disabled={actionPending}
              onClick={() => setConfirmAction('archive')}
              className="flex items-center gap-2 rounded-lg border border-[#e4e1da] px-3 py-2 text-xs font-semibold text-[#486362] hover:bg-[#f0eee8] disabled:opacity-60"
            >
              <Archive size={14} /> Archive
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 flex gap-1 border-b border-[#e4e1da]">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-semibold transition ${
              activeTab === tab ? 'border-b-2 border-[#102b35] text-[#102b35]' : 'text-[#718684] hover:text-[#486362]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="border border-[#e4e1da] bg-[#fbfaf7] p-4">
            <p className="text-xs font-semibold text-[#718684]">Effective date</p>
            <p className="mt-2 font-display text-lg font-bold text-[#102b35]">{regulation.effectiveDate}</p>
          </div>
          <div className="border border-[#e4e1da] bg-[#fbfaf7] p-4">
            <p className="text-xs font-semibold text-[#718684]">Last modified</p>
            <p className="mt-2 font-display text-lg font-bold text-[#102b35]">{regulation.lastModified}</p>
          </div>
          <div className="border border-[#e4e1da] bg-[#fbfaf7] p-4">
            <p className="text-xs font-semibold text-[#718684]">Active rules</p>
            <p className="mt-2 font-display text-lg font-bold text-[#102b35]">
              {regulationRules.filter((r) => r.active).length} / {regulationRules.length}
            </p>
          </div>
        </div>
      )}

      {activeTab === 'Rules' && (
        <div className="space-y-3">
          {regulationRules.length === 0 ? (
            <div className="border border-dashed border-[#d8d3c8] bg-[#fbfaf7] py-10 text-center text-sm text-[#9aa8a5]">
              No rules attached yet.{' '}
              <Link to="/rule-engine" className="font-semibold text-[#d46f51]">
                Build one in the rule engine.
              </Link>
            </div>
          ) : (
            regulationRules.map((rule) => (
              <div key={rule.id} className="border border-[#e4e1da] bg-[#fbfaf7] p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#173640]">{rule.name}</p>
                  <StatusBadge status={rule.active ? 'active' : 'draft'} label={rule.active ? 'active' : 'inactive'} />
                </div>
                <p className="mt-1 text-xs uppercase tracking-wide text-[#9aa8a5]">{rule.type.replace('_', ' ')}</p>
                <p className="mt-2 text-xs text-[#718684]">
                  {rule.conditions.map((c) => `${c.field} ${c.operator} ${c.value}`).join(' AND ')} → {rule.outcome}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'Version history' && (
        <div className="space-y-3">
          {regulation.versions.map((v) => (
            <div key={v.version} className="flex gap-4 border border-[#e4e1da] bg-[#fbfaf7] p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#edf0eb] text-[#617773]">
                <GitCommitHorizontal size={15} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#173640]">
                  v{v.version} <span className="font-normal text-[#9aa8a5]">· {v.changedAt}</span>
                </p>
                <p className="mt-1 text-xs text-[#718684]">{v.changeSummary}</p>
                <p className="mt-1 text-[10px] text-[#9aa8a5]">by {v.changedBy}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Approval workflow' && (
        <div className="space-y-3">
          {regulation.approvalHistory.map((step, index) => (
            <div key={index} className="flex gap-4 border border-[#e4e1da] bg-[#fbfaf7] p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d8f4ed] text-[#087f72]">
                {step.step === 'rejected' ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
              </div>
              <div>
                <p className="text-sm font-semibold capitalize text-[#173640]">{step.step.replace('_', ' ')}</p>
                <p className="mt-1 text-xs text-[#718684]">by {step.by} · {new Date(step.at).toLocaleString()}</p>
                {step.note && <p className="mt-1 flex items-center gap-1 text-xs text-[#9aa8a5]"><FileText size={12} /> {step.note}</p>}
              </div>
            </div>
          ))}
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
    </div>
  )
}
