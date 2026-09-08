import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, FlaskConical, Loader2, PlayCircle, History as HistoryIcon, Users, Sparkles } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { useAiAssistant } from '@/contexts/AiAssistantContext'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import FormField, { inputClassName } from '@/components/ui/FormField'
import * as simulatorApi from '@/api/simulator'
import * as regulationsApi from '@/api/regulations'
import * as rulesApi from '@/api/rules'
import * as studentsApi from '@/api/students'
import { ApiRequestError } from '@/api/client'
import { collectConditionFields } from '@/utils/conditionTree'
import { summarizeBatchResults } from '@/utils/batchSummary'
import type { BatchSimulationSummary } from '@/api/simulator'
import type { RegulationWithRuleCount } from '@/api/regulations'
import type { Rule, SimulationResult, Student } from '@/types'

export default function SimulatorPage() {
  const { showToast } = useToast()
  const { user } = useAuth()
  const { presentSummary } = useAiAssistant()
  const isStudent = user?.role === 'student'

  const [regulations, setRegulations] = useState<RegulationWithRuleCount[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [results, setResults] = useState<SimulationResult[]>([])
  const [cohortStudents, setCohortStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [regulationId, setRegulationId] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [isRunning, setIsRunning] = useState(false)
  const [latestResultId, setLatestResultId] = useState<string | null>(null)

  const [batchSearch, setBatchSearch] = useState('')
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set())
  const [isRunningBatch, setIsRunningBatch] = useState(false)
  const [batchSummary, setBatchSummary] = useState<BatchSimulationSummary | null>(null)

  async function loadData() {
    setLoading(true)
    setLoadError('')
    try {
      const [regRows, ruleRows, historyRows, studentRows] = await Promise.all([
        regulationsApi.list(),
        rulesApi.list(),
        simulatorApi.history(),
        user?.role === 'student' ? Promise.resolve([]) : studentsApi.list(),
      ])
      setRegulations(regRows)
      setRules(ruleRows)
      setResults(historyRows)
      setCohortStudents(studentRows)
      setRegulationId((prev) => prev || regRows[0]?.id || '')
    } catch (err) {
      setLoadError(err instanceof ApiRequestError ? err.message : 'Failed to load the simulator.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applicableRules = useMemo(() => rules.filter((r) => r.regulationId === regulationId && r.active), [rules, regulationId])
  const uniqueFields = useMemo(() => {
    const fieldSet = new Set<string>()
    applicableRules.forEach((r) => collectConditionFields(r.conditionTree, fieldSet))
    return Array.from(fieldSet)
  }, [applicableRules])

  async function runSimulation() {
    if (!regulationId || applicableRules.length === 0) {
      showToast('Select a regulation with at least one active rule.', 'error')
      return
    }
    if (isStudent && !user?.studentId) {
      showToast('Your account is not linked to a student record yet — contact an administrator.', 'error')
      return
    }
    setIsRunning(true)
    try {
      const result = await simulatorApi.run({
        regulationId,
        studentId: isStudent ? user?.studentId : undefined,
        customValues: fieldValues,
      })
      setResults((prev) => [result, ...prev])
      setLatestResultId(result.id)
      showToast(`Simulation complete: ${result.outcome.replace(/_/g, ' ')}.`)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to run simulation.', 'error')
    } finally {
      setIsRunning(false)
    }
  }

  const latestResult = results.find((r) => r.id === latestResultId)

  const filteredCohort = useMemo(() => {
    const q = batchSearch.trim().toLowerCase()
    if (!q) return cohortStudents
    return cohortStudents.filter(
      (s) => s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    )
  }, [cohortStudents, batchSearch])

  const allFilteredSelected = filteredCohort.length > 0 && filteredCohort.every((s) => selectedBatchIds.has(s.id))

  function toggleBatchStudent(id: string) {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllFiltered() {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) filteredCohort.forEach((s) => next.delete(s.id))
      else filteredCohort.forEach((s) => next.add(s.id))
      return next
    })
  }

  async function runBatchSimulation() {
    if (!regulationId || applicableRules.length === 0 || selectedBatchIds.size === 0) return
    setIsRunningBatch(true)
    setBatchSummary(null)
    try {
      const summary = await simulatorApi.runBatch({
        regulationId,
        studentIds: [...selectedBatchIds],
        customValues: fieldValues,
      })
      setBatchSummary(summary)
      showToast(`Batch complete: ${summary.succeeded} of ${summary.totalStudents} students evaluated.`)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to run the batch simulation.', 'error')
    } finally {
      setIsRunningBatch(false)
    }
  }

  function summarizeBatchWithAi() {
    if (!batchSummary) return
    const regulationName = regulations.find((r) => r.id === batchSummary.regulationId)?.name ?? 'this regulation'
    presentSummary(summarizeBatchResults(batchSummary, regulationName))
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[#475569]" size={28} />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 pb-10 pt-8 sm:px-9 lg:px-12">
        <EmptyState icon={AlertCircle} title="Couldn't load the simulator" description={loadError} action={{ label: 'Retry', onClick: loadData }} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-10 pt-8 sm:px-9 lg:px-12">
      <div className="mb-8">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#4f46e5]">What-if Analysis</p>
        <h1 className="font-display text-[32px] font-bold tracking-[-0.04em] text-[#0f172a]">Rule Simulator</h1>
        <p className="mt-2 text-sm text-[#64748b]">
          Test a regulation's rules against a real student or a hypothetical scenario before publishing.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <section className="border border-[#e2e8f0] bg-[#ffffff] p-5 sm:p-6">
          <h2 className="mb-4 font-display text-lg font-bold text-[#0f172a]">Scenario setup</h2>

          {regulations.length === 0 ? (
            <p className="text-xs text-[#94a3b8]">No regulations are available to simulate against.</p>
          ) : (
            <>
              <FormField label="Regulation" htmlFor="sim-regulation" required>
                <select
                  id="sim-regulation"
                  className={inputClassName}
                  value={regulationId}
                  onChange={(e) => {
                    setRegulationId(e.target.value)
                    setLatestResultId(null)
                  }}
                >
                  {regulations.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </FormField>

              {isStudent ? (
                <p className="mb-4 text-xs text-[#64748b]">
                  Running as <span className="font-semibold text-[#475569]">{user?.name}</span> — students can only
                  simulate their own record.
                </p>
              ) : (
                <p className="mb-4 text-xs text-[#94a3b8]">
                  Running a custom scenario. Testing against a specific student's real data will be available once
                  student records are connected.
                </p>
              )}

              {applicableRules.length === 0 ? (
                <p className="mt-4 text-xs text-[#94a3b8]">This regulation has no active rules to simulate.</p>
              ) : (
                <div className="mt-2 space-y-1">
                  <p className="mb-2 text-xs font-semibold text-[#475569]">Scenario inputs</p>
                  {uniqueFields.map((field) => (
                    <FormField key={field} label={field} htmlFor={`field-${field}`}>
                      <input
                        id={`field-${field}`}
                        className={inputClassName}
                        value={fieldValues[field] ?? ''}
                        onChange={(e) => setFieldValues((prev) => ({ ...prev, [field]: e.target.value }))}
                        placeholder="Enter a value"
                      />
                    </FormField>
                  ))}
                </div>
              )}

              <button
                onClick={runSimulation}
                disabled={isRunning || applicableRules.length === 0 || (isStudent && !user?.studentId)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRunning ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
                {isRunning ? 'Running simulation...' : 'Run simulation'}
              </button>
            </>
          )}
        </section>

        <section className="border border-[#e2e8f0] bg-[#ffffff] p-5 sm:p-6">
          <h2 className="mb-4 font-display text-lg font-bold text-[#0f172a]">Result</h2>
          {!latestResult ? (
            <EmptyState icon={FlaskConical} title="No simulation run yet" description="Configure a scenario on the left and run it to see a rule-by-rule breakdown." />
          ) : (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#0f172a]">{latestResult.studentName}</p>
                <StatusBadge status={latestResult.outcome} />
              </div>
              <div className="space-y-2">
                {latestResult.breakdown.map((b, i) => (
                  <div key={i} className={`border-l-4 p-3 text-xs ${b.passed ? 'border-[#22c55e] bg-[#f0fdf4]' : 'border-[#dc2626] bg-[#fef2f2]'}`}>
                    <p className="font-semibold text-[#0f172a]">
                      {b.passed ? '✓' : '✗'} {b.rule}
                    </p>
                    <p className="mt-1 text-[#64748b]">{b.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {!isStudent && (
        <section className="mt-6 border border-[#e2e8f0] bg-[#ffffff] p-5 sm:p-6">
          <div className="mb-1 flex items-center gap-2">
            <Users size={16} className="text-[#475569]" />
            <h2 className="font-display text-lg font-bold text-[#0f172a]">Cohort simulation</h2>
          </div>
          <p className="mb-4 text-xs text-[#64748b]">
            Run the scenario above against many students at once — using the same regulation and scenario inputs
            selected above — and see aggregated pass/fail metrics.
          </p>
          <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <FormField label="Search students" htmlFor="batch-search">
                <input
                  id="batch-search"
                  className={inputClassName}
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  placeholder="Name, email, or student ID..."
                />
              </FormField>
              <div className="mb-2 flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 font-semibold text-[#475569]">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    className="h-4 w-4 accent-[#4f46e5]"
                  />
                  Select all ({filteredCohort.length})
                </label>
                <span className="text-[#94a3b8]">{selectedBatchIds.size} selected</span>
              </div>
              <div className="max-h-64 overflow-y-auto border border-[#e2e8f0]">
                {filteredCohort.length === 0 ? (
                  <p className="p-3 text-xs text-[#94a3b8]">No students match.</p>
                ) : (
                  filteredCohort.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 border-b border-[#e2e8f0] px-3 py-2 text-xs last:border-b-0 hover:bg-[#f8fafc]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBatchIds.has(s.id)}
                        onChange={() => toggleBatchStudent(s.id)}
                        className="h-4 w-4 shrink-0 accent-[#4f46e5]"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-semibold text-[#0f172a]">{s.name}</span>{' '}
                        <span className="text-[#94a3b8]">· {s.studentId}</span>
                      </span>
                    </label>
                  ))
                )}
              </div>
              <button
                onClick={runBatchSimulation}
                disabled={isRunningBatch || applicableRules.length === 0 || selectedBatchIds.size === 0}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRunningBatch ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
                {isRunningBatch ? 'Running batch...' : `Run batch simulation${selectedBatchIds.size ? ` (${selectedBatchIds.size})` : ''}`}
              </button>
            </div>

            <div>
              {!batchSummary ? (
                <EmptyState
                  icon={Users}
                  title="No batch run yet"
                  description="Select students on the left and run a batch simulation to see aggregated results here."
                />
              ) : (
                <div>
                  <div className="mb-4 grid grid-cols-3 gap-2">
                    <div className="border border-[#dcfce7] bg-[#f0fdf4] p-2 text-center">
                      <p className="font-display text-lg font-bold text-[#16a34a]">{batchSummary.outcomeCounts.eligible}</p>
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-[#64748b]">Eligible</p>
                    </div>
                    <div className="border border-[#e0e7ff] bg-[#eef2ff] p-2 text-center">
                      <p className="font-display text-lg font-bold text-[#4f46e5]">{batchSummary.outcomeCounts.eligible_with_conditions}</p>
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-[#64748b]">With conditions</p>
                    </div>
                    <div className="border border-[#fee2e2] bg-[#fef2f2] p-2 text-center">
                      <p className="font-display text-lg font-bold text-[#dc2626]">{batchSummary.outcomeCounts.not_eligible}</p>
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-[#64748b]">Not eligible</p>
                    </div>
                  </div>

                  {batchSummary.ruleBreakdown.length > 0 && (
                    <div className="mb-4 space-y-2">
                      {batchSummary.ruleBreakdown.map((rb) => {
                        const total = rb.passed + rb.failed
                        const pct = total > 0 ? Math.round((rb.passed / total) * 100) : 0
                        return (
                          <div key={rb.rule}>
                            <div className="mb-1 flex justify-between text-[11px]">
                              <span className="font-medium text-[#475569]">{rb.rule}</span>
                              <span className="text-[#94a3b8]">{rb.passed}/{total} passed</span>
                            </div>
                            <div className="h-1.5 bg-[#f1f5f9]">
                              <div className="h-full bg-[#16a34a]" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {batchSummary.failed > 0 && (
                    <p className="mb-3 text-[11px] font-semibold text-[#dc2626]">
                      {batchSummary.failed} student{batchSummary.failed === 1 ? '' : 's'} could not be evaluated — see the table below.
                    </p>
                  )}

                  <button
                    onClick={summarizeBatchWithAi}
                    className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#e0e7ff] bg-[#eef2ff] px-3 py-2 text-xs font-semibold text-[#4f46e5] hover:bg-[#e0e7ff]"
                  >
                    <Sparkles size={13} /> Summarize with AI
                  </button>

                  <div className="max-h-56 overflow-y-auto border border-[#e2e8f0]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-left text-[#64748b]">
                          <th className="px-3 py-2 font-semibold">Student</th>
                          <th className="px-3 py-2 font-semibold">Outcome</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchSummary.results.map((r) => (
                          <tr key={r.studentId} className="border-b border-[#e2e8f0] last:border-b-0">
                            <td className="px-3 py-2 font-semibold text-[#0f172a]">{r.studentName || r.studentId}</td>
                            <td className="px-3 py-2">
                              {r.outcome ? <StatusBadge status={r.outcome} /> : <span className="text-[#dc2626]">{r.error}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="mt-6 border border-[#e2e8f0] bg-[#ffffff] p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <HistoryIcon size={16} className="text-[#475569]" />
          <h2 className="font-display text-lg font-bold text-[#0f172a]">Simulation history</h2>
        </div>
        {results.length === 0 ? (
          <p className="text-xs text-[#94a3b8]">No simulations run yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] text-left text-xs text-[#64748b]">
                  <th className="py-2 pr-4 font-semibold">Scenario</th>
                  <th className="py-2 pr-4 font-semibold">Regulation</th>
                  <th className="py-2 pr-4 font-semibold">Outcome</th>
                  <th className="py-2 pr-4 font-semibold">Ran</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="cursor-pointer border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f8fafc]" onClick={() => setLatestResultId(r.id)}>
                    <td className="py-2.5 pr-4 font-semibold text-[#0f172a]">{r.studentName}</td>
                    <td className="py-2.5 pr-4 text-[#475569]">{regulations.find((reg) => reg.id === r.regulationId)?.name}</td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge status={r.outcome} />
                    </td>
                    <td className="py-2.5 pr-4 text-[#94a3b8]">{new Date(r.ranAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
