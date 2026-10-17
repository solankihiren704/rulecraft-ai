import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowUpRight,
  Award,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  GitBranch,
  GitCommitHorizontal,
  GraduationCap,
  MoreHorizontal,
  Sparkles,
} from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import EmptyState from '@/components/ui/EmptyState'
import * as dashboardApi from '@/api/dashboard'
import { ApiRequestError } from '@/api/client'
import type { DashboardActivityItem, DashboardSummary } from '@/types'

const toneClasses = {
  teal: 'bg-[#dcfce7] text-[#16a34a]',
  blue: 'bg-[#dbeafe] text-[#2563eb]',
  coral: 'bg-[#fee2e2] text-[#dc2626]',
  amber: 'bg-[#fef3c7] text-[#d97706]',
} as const
type Tone = keyof typeof toneClasses

const activityTone: Record<DashboardActivityItem['type'], Tone> = {
  approval_step: 'teal',
  regulation_version: 'blue',
  simulation: 'coral',
}
const activityIcon: Record<DashboardActivityItem['type'], typeof CheckCircle2> = {
  approval_step: CheckCircle2,
  regulation_version: GitCommitHorizontal,
  simulation: FlaskConical,
}

const statusBarColor: Record<string, string> = {
  published: 'bg-[#22c55e]',
  review: 'bg-[#4f46e5]',
  draft: 'bg-[#f59e0b]',
  archived: 'bg-[#b8c5bd]',
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse bg-[#e2e8f0] ${className}`} />
}

const NAME_TITLES = new Set(['dr', 'mr', 'mrs', 'ms', 'prof'])

// "Dr. Meera Nair".split(' ')[0] is "Dr." — a title, not a name, and one
// that already ends in a period, which doubled up with the greeting's own
// "." into "Good morning, Dr..". Skip a leading title and strip any
// trailing period so the greeting's period is never duplicated.
function greetingName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const first = parts.find((part, i) => !(i === 0 && NAME_TITLES.has(part.replace(/\.$/, '').toLowerCase())))
  return (first ?? parts[0] ?? 'there').replace(/\.$/, '')
}

function timeAgo(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr ago`
  const diffDay = Math.round(diffHr / 24)
  return diffDay === 1 ? 'Yesterday' : `${diffDay} days ago`
}

type KpiKind = 'students' | 'checks' | 'eligible' | 'rules' | 'regulations'

interface KpiTile {
  label: string
  value: number
  detail: string
  kind: KpiKind
}

const kpiIcon: Record<KpiKind, typeof GraduationCap> = {
  students: GraduationCap,
  checks: ClipboardCheck,
  eligible: CheckCircle2,
  rules: GitBranch,
  regulations: BookOpenCheck,
}

function buildKpis(summary: DashboardSummary): KpiTile[] {
  const publishedCount = summary.regulations.byStatus.find((s) => s.status === 'published')?.count ?? 0
  const eligibleCount = summary.simulations.byOutcome.find((o) => o.outcome === 'eligible')?.count ?? 0

  if (!summary.students) {
    // Student view: there's no "their department" aggregate that makes
    // sense for a single student, so the four tiles are the metrics that
    // are genuinely about them or genuinely visible to them.
    return [
      { label: 'Your eligibility checks', value: summary.simulations.total, detail: 'last 30 days shown below', kind: 'checks' },
      { label: 'Eligible outcomes', value: eligibleCount, detail: 'of your checks', kind: 'eligible' },
      { label: 'Published regulations', value: publishedCount, detail: 'visible to you', kind: 'regulations' },
      { label: 'Visible rules', value: summary.rules.total, detail: `${summary.rules.active} active`, kind: 'rules' },
    ]
  }

  return [
    { label: 'Active students', value: summary.students.active, detail: `${summary.students.total} total`, kind: 'students' },
    { label: 'Eligibility checks', value: summary.simulations.total, detail: 'all time', kind: 'checks' },
    { label: 'Rules', value: summary.rules.total, detail: `${summary.rules.active} active`, kind: 'rules' },
    { label: 'Regulations', value: summary.regulations.total, detail: `${publishedCount} published`, kind: 'regulations' },
  ]
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activityMenuOpen, setActivityMenuOpen] = useState(false)

  async function loadData() {
    setLoading(true)
    setLoadError('')
    try {
      setSummary(await dashboardApi.summary())
    } catch (err) {
      setLoadError(err instanceof ApiRequestError ? err.message : 'Failed to load the dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const firstName = user ? greetingName(user.name) : 'there'
  const isStudent = !summary?.students

  const kpis = useMemo(() => (summary ? buildKpis(summary) : []), [summary])
  const chartData = useMemo(
    () => summary?.simulations.byDay.map((d) => ({ day: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), checks: d.count })) ?? [],
    [summary],
  )

  if (loading) {
    return (
      <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-8 sm:px-9 lg:px-12">
        <SkeletonBlock className="mb-3 h-4 w-40" />
        <SkeletonBlock className="mb-8 h-9 w-72" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} className="h-28" />
          ))}
        </div>
        <SkeletonBlock className="mt-5 h-72 w-full" />
      </div>
    )
  }

  if (loadError || !summary) {
    return (
      <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-8 sm:px-9 lg:px-12">
        <EmptyState icon={AlertCircle} title="Couldn't load the dashboard" description={loadError || 'Something went wrong.'} action={{ label: 'Retry', onClick: loadData }} />
      </div>
    )
  }

  // Bound to a local const (rather than reading summary.students inline)
  // so TypeScript's null-narrowing survives into the .map() callback below.
  const students = summary.students

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-8 sm:px-9 lg:px-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#4f46e5]">Overview</p>
          <h1 className="font-display text-[32px] font-bold tracking-[-0.04em] text-[#0f172a] sm:text-[38px]">
            Good morning, {firstName}.
          </h1>
          <p className="mt-2 text-sm font-medium text-[#475569]">Here is what is happening across your academic ecosystem.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => navigate('/results')}
            className="flex w-fit items-center gap-2 rounded-lg bg-[#4338ca] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#3730a3]"
          >
            <Award size={15} className="text-[#c7d2fe]" />
            {isStudent ? 'View My Final Result' : 'View Final Results'}
          </button>
          <button
            onClick={() => navigate('/simulator')}
            className="flex w-fit items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1e293b]"
          >
            <Sparkles size={15} className="text-[#818cf8]" />
            Run eligibility check
            <ArrowUpRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpiIcon[kpi.kind]
          return (
            <div key={kpi.label} className="border border-[#e2e8f0] bg-[#ffffff] p-5">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e0e7ff] text-[#4f46e5]">
                  <Icon size={15} />
                </div>
                <p className="text-xs font-semibold text-[#64748b]">{kpi.label}</p>
              </div>
              <p className="font-display text-[30px] font-bold tracking-[-0.04em] text-[#0f172a]">{kpi.value.toLocaleString()}</p>
              <p className="mt-1 text-[11px] text-[#94a3b8]">{kpi.detail}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-8 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className="border border-[#e2e8f0] bg-[#ffffff] p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-[#0f172a]">Eligibility activity</h2>
              <p className="mt-1 text-xs text-[#64748b]">
                {isStudent ? 'Your checks over the last 30 days' : 'Checks run across all programs, last 30 days'}
              </p>
            </div>
            <div className="relative">
              <button
                onClick={() => setActivityMenuOpen((open) => !open)}
                className="text-[#475569]"
                aria-label="More activity options"
                aria-haspopup="menu"
                aria-expanded={activityMenuOpen}
              >
                <MoreHorizontal size={19} />
              </button>
              {activityMenuOpen && (
                <div role="menu" className="absolute right-0 top-7 z-10 w-40 border border-[#e2e8f0] bg-[#ffffff] p-1 text-xs shadow-lg">
                  <button
                    onClick={() => {
                      setActivityMenuOpen(false)
                      loadData()
                    }}
                    className="w-full px-3 py-2 text-left text-[#475569] hover:bg-[#f1f5f9]"
                  >
                    Refresh data
                  </button>
                  <button
                    onClick={() => {
                      setActivityMenuOpen(false)
                      showToast('Export is not available yet.', 'error')
                    }}
                    className="w-full px-3 py-2 text-left text-[#475569] hover:bg-[#f1f5f9]"
                  >
                    Export snapshot
                  </button>
                </div>
              )}
            </div>
          </div>
          {chartData.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="No eligibility checks in the last 30 days"
              description={
                isStudent
                  ? 'Run a what-if check in the Simulator to see your eligibility activity here.'
                  : 'Once eligibility checks are run, activity over the last 30 days will show up here.'
              }
              action={{ label: 'Run eligibility check', onClick: () => navigate('/simulator') }}
            />
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="checksFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <Tooltip
                    contentStyle={{ border: '1px solid #e2e8f0', fontSize: 12, borderRadius: 0 }}
                    formatter={(value) => [Number(value).toLocaleString(), 'Checks']}
                  />
                  <Area type="monotone" dataKey="checks" stroke="#16a34a" strokeWidth={2} fill="url(#checksFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="border border-[#e2e8f0] bg-[#ffffff] p-5 sm:p-6">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-[#0f172a]">Regulation status</h2>
              <p className="mt-1 text-xs text-[#64748b]">{isStudent ? 'Regulations visible to you' : 'Across your visible regulations'}</p>
            </div>
          </div>
          {summary.regulations.total === 0 ? (
            <p className="text-xs text-[#94a3b8]">No regulations to show.</p>
          ) : (
            <div className="space-y-5">
              {summary.regulations.byStatus.map((s) => {
                const percent = Math.round((s.count / summary.regulations.total) * 100)
                return (
                  <div key={s.status}>
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="font-medium capitalize text-[#475569]">{s.status}</span>
                      <span className="font-bold text-[#0f172a]">{s.count}</span>
                    </div>
                    <div className="h-2 bg-[#f1f5f9]">
                      <div className={`h-full ${statusBarColor[s.status] ?? 'bg-[#b8c5bd]'}`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-7 flex items-center gap-3 border-t border-[#e2e8f0] pt-4 text-[11px] text-[#64748b]">
            Data as of {new Date(summary.generatedAt).toLocaleTimeString()}
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className="border border-[#e2e8f0] bg-[#ffffff] p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-[#0f172a]">{students ? 'Program pulse' : 'Rule coverage'}</h2>
              <p className="mt-1 text-xs text-[#64748b]">{students ? 'Student distribution by department' : 'Visible rules by type'}</p>
            </div>
            <button onClick={() => navigate('/reports')} className="text-xs font-semibold text-[#4f46e5]">
              View report <ArrowUpRight size={13} className="ml-1 inline" />
            </button>
          </div>
          {students ? (
            students.byDepartment.length === 0 ? (
              <p className="text-xs text-[#94a3b8]">No students to show.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {students.byDepartment.map(({ departmentName, count }) => (
                  <div key={departmentName} className="border-l-2 border-[#e2e8f0] pl-3">
                    <div className="mb-3 h-1.5 w-8 bg-[#4f46e5]" />
                    <p className="text-[11px] font-semibold text-[#475569]">{departmentName}</p>
                    <p className="mt-1 font-display text-xl font-bold text-[#0f172a]">{count}</p>
                    <p className="mt-1 text-[10px] text-[#94a3b8]">{Math.round((count / students.total) * 100)}% of total</p>
                  </div>
                ))}
              </div>
            )
          ) : summary.rules.byType.length === 0 ? (
            <p className="text-xs text-[#94a3b8]">No rules to show.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {summary.rules.byType.map(({ type, count }) => (
                <div key={type} className="border-l-2 border-[#e2e8f0] pl-3">
                  <div className="mb-3 h-1.5 w-8 bg-[#4f46e5]" />
                  <p className="text-[11px] font-semibold capitalize text-[#475569]">{type.replace(/_/g, ' ')}</p>
                  <p className="mt-1 font-display text-xl font-bold text-[#0f172a]">{count}</p>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="border border-[#e2e8f0] bg-[#ffffff] p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#0f172a]">Recent activity</h2>
            <button onClick={() => showToast('Full activity history is not available yet.', 'error')} className="text-xs font-semibold text-[#4f46e5]">
              See all
            </button>
          </div>
          {summary.recentActivity.length === 0 ? (
            <p className="text-xs text-[#94a3b8]">Nothing yet.</p>
          ) : (
            <div className="space-y-4">
              {summary.recentActivity.map((item, i) => {
                const Icon = activityIcon[item.type]
                const tone = activityTone[item.type]
                return (
                  <div key={i} className="flex gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toneClasses[tone]}`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold leading-4 text-[#334155]">{item.description}</p>
                      <p className="mt-1 text-[10px] leading-4 text-[#94a3b8]">{timeAgo(item.at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
      <footer className="mt-8 flex items-center justify-between text-[10px] text-[#94a3b8]">
        <span>RuleCraft Academic OS · v1.0.0</span>
        <span className="hidden sm:inline">Data as of {new Date(summary.generatedAt).toLocaleString()}</span>
      </footer>
    </div>
  )
}
