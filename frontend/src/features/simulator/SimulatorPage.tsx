import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, FlaskConical, Loader2, PlayCircle, History as HistoryIcon } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import FormField, { inputClassName } from '@/components/ui/FormField'
import * as simulatorApi from '@/api/simulator'
import * as regulationsApi from '@/api/regulations'
import * as rulesApi from '@/api/rules'
import { ApiRequestError } from '@/api/client'
import { collectConditionFields } from '@/utils/conditionTree'
import type { RegulationWithRuleCount } from '@/api/regulations'
import type { Rule, SimulationResult } from '@/types'

export default function SimulatorPage() {
  const { showToast } = useToast()
  const { user } = useAuth()
  const isStudent = user?.role === 'student'

  const [regulations, setRegulations] = useState<RegulationWithRuleCount[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [results, setResults] = useState<SimulationResult[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [regulationId, setRegulationId] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [isRunning, setIsRunning] = useState(false)
  const [latestResultId, setLatestResultId] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setLoadError('')
    try {
      const [regRows, ruleRows, historyRows] = await Promise.all([
        regulationsApi.list(),
        rulesApi.list(),
        simulatorApi.history(),
      ])
      setRegulations(regRows)
      setRules(ruleRows)
      setResults(historyRows)
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
