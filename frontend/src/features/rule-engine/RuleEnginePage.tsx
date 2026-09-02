import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, GitBranch, Plus, Search, Edit2, Trash2, X, Loader2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import FormField, { inputClassName } from '@/components/ui/FormField'
import * as rulesApi from '@/api/rules'
import * as regulationsApi from '@/api/regulations'
import { ApiRequestError } from '@/api/client'
import type { RegulationWithRuleCount } from '@/api/regulations'
import type { Rule, RuleType } from '@/types'

const ruleTypes: { id: RuleType; label: string }[] = [
  { id: 'attendance', label: 'Attendance' },
  { id: 'passing', label: 'Passing' },
  { id: 'grading', label: 'Grading' },
  { id: 'promotion', label: 'Promotion' },
  { id: 'backlog', label: 'Backlog / ATKT' },
  { id: 'grace_marks', label: 'Grace marks' },
]

const operators = [
  { id: 'gte', label: '>= (at least)' },
  { id: 'lte', label: '<= (at most)' },
  { id: 'gt', label: '> (more than)' },
  { id: 'lt', label: '< (less than)' },
  { id: 'eq', label: '= (equals)' },
  { id: 'neq', label: '!= (not equal)' },
]

const conditionSchema = z.object({
  field: z.string().min(1, 'Field is required.'),
  operator: z.enum(['gte', 'lte', 'gt', 'lt', 'eq', 'neq']),
  value: z.string().min(1, 'Value is required.'),
})

const schema = z.object({
  name: z.string().min(3, 'Rule name must be at least 3 characters.'),
  regulationId: z.string().min(1, 'Select a regulation.'),
  type: z.enum(['attendance', 'passing', 'grading', 'promotion', 'backlog', 'grace_marks']),
  outcome: z.string().min(3, 'Describe the outcome.'),
  active: z.boolean(),
  conditions: z.array(conditionSchema).min(1, 'Add at least one condition.'),
})

type FormValues = z.infer<typeof schema>
const topLevelFields: (keyof FormValues)[] = ['name', 'regulationId', 'type', 'outcome', 'active']

export default function RuleEnginePage() {
  const { showToast } = useToast()
  const { user } = useAuth()
  const canManage = user?.role === 'super_admin' || user?.role === 'registrar'

  const [rules, setRules] = useState<Rule[]>([])
  const [regulations, setRegulations] = useState<RegulationWithRuleCount[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [filterRegulation, setFilterRegulation] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [deletingRule, setDeletingRule] = useState<Rule | null>(null)

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })
  const { fields, append, remove } = useFieldArray({ control, name: 'conditions' })

  async function loadData() {
    setLoading(true)
    setLoadError('')
    try {
      const [ruleRows, regRows] = await Promise.all([rulesApi.list(), regulationsApi.list()])
      setRules(ruleRows)
      setRegulations(regRows)
    } catch (err) {
      setLoadError(err instanceof ApiRequestError ? err.message : 'Failed to load rules.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return rules.filter((rule) => {
      const matchesSearch = !q || rule.name.toLowerCase().includes(q)
      const matchesRegulation = filterRegulation === 'all' || rule.regulationId === filterRegulation
      const matchesType = filterType === 'all' || rule.type === filterType
      return matchesSearch && matchesRegulation && matchesType
    })
  }, [rules, searchQuery, filterRegulation, filterType])

  function regulationName(id: string) {
    return regulations.find((r) => r.id === id)?.name ?? 'Unknown regulation'
  }

  function openCreate() {
    setEditingRule(null)
    reset({
      name: '',
      regulationId: regulations[0]?.id ?? '',
      type: 'attendance',
      outcome: '',
      active: true,
      conditions: [{ field: 'attendancePercent', operator: 'gte', value: '75' }],
    })
    setModalOpen(true)
  }

  function openEdit(rule: Rule) {
    setEditingRule(rule)
    reset({
      name: rule.name,
      regulationId: rule.regulationId,
      type: rule.type,
      outcome: rule.outcome,
      active: rule.active,
      conditions: rule.conditions.map(({ field, operator, value }) => ({ field, operator, value })),
    })
    setModalOpen(true)
  }

  async function onSubmit(values: FormValues) {
    try {
      if (editingRule) {
        const { regulationId: _regulationId, ...updateInput } = values
        const updated = await rulesApi.update(editingRule.id, updateInput)
        setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
        showToast(`${updated.name} updated.`)
      } else {
        const created = await rulesApi.create(values)
        setRules((prev) => [created, ...prev])
        showToast(`${created.name} created.`)
      }
      setModalOpen(false)
    } catch (err) {
      if (err instanceof ApiRequestError && err.fieldErrors) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (topLevelFields.includes(field as keyof FormValues)) {
            setError(field as keyof FormValues, { message })
          }
        }
      } else {
        showToast(err instanceof ApiRequestError ? err.message : 'Something went wrong.', 'error')
      }
    }
  }

  async function toggleActive(rule: Rule) {
    try {
      const updated = await rulesApi.toggleActive(rule.id)
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      showToast(`${updated.name} ${updated.active ? 'activated' : 'deactivated'}.`)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to update rule.', 'error')
    }
  }

  async function confirmDelete() {
    if (!deletingRule) return
    try {
      await rulesApi.remove(deletingRule.id)
      setRules((prev) => prev.filter((r) => r.id !== deletingRule.id))
      showToast(`${deletingRule.name} deleted.`)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to delete rule.', 'error')
    } finally {
      setDeletingRule(null)
    }
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
      <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-8 sm:px-9 lg:px-12">
        <EmptyState icon={AlertCircle} title="Couldn't load rules" description={loadError} action={{ label: 'Retry', onClick: loadData }} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-8 sm:px-9 lg:px-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#4f46e5]">Decision Logic</p>
          <h1 className="font-display text-[32px] font-bold tracking-[-0.04em] text-[#0f172a]">Rule Engine</h1>
          <p className="mt-2 text-sm text-[#64748b]">
            Build the conditions that decide attendance, passing, grading, promotion, backlog, and grace-mark outcomes.
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex w-fit items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1e293b]"
          >
            <Plus size={15} /> New rule
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <div className="flex items-center gap-2 border-b border-[#cbd5e1] px-3 py-2 text-[#64748b]">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-[#0f172a] placeholder-[#94a3b8] outline-none"
            />
          </div>
        </div>
        <select value={filterRegulation} onChange={(e) => setFilterRegulation(e.target.value)} className="rounded border border-[#e2e8f0] bg-[#ffffff] px-3 py-2 text-xs text-[#475569] outline-none">
          <option value="all">All regulations</option>
          {regulations.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded border border-[#e2e8f0] bg-[#ffffff] px-3 py-2 text-xs text-[#475569] outline-none">
          <option value="all">All types</option>
          {ruleTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No rules found"
          description="Try a different search or filter, or create your first rule."
          action={canManage ? { label: 'New rule', onClick: openCreate } : { label: 'Clear filters', onClick: () => { setSearchQuery(''); setFilterRegulation('all'); setFilterType('all') } }}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((rule) => (
            <div key={rule.id} className="border border-[#e2e8f0] bg-[#ffffff] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[#0f172a]">{rule.name}</p>
                    <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#475569]">
                      {ruleTypes.find((t) => t.id === rule.type)?.label}
                    </span>
                  </div>
                  <p className="text-xs text-[#94a3b8]">{regulationName(rule.regulationId)}</p>
                  <p className="mt-2 text-xs text-[#475569]">
                    <span className="font-mono">
                      {rule.conditions.map((c) => `${c.field} ${operators.find((o) => o.id === c.operator)?.id ?? c.operator} ${c.value}`).join('  AND  ')}
                    </span>{' '}
                    → {rule.outcome}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <label className={`flex items-center gap-2 text-[11px] font-semibold text-[#64748b] ${canManage ? 'cursor-pointer' : 'cursor-default'}`}>
                    <input
                      type="checkbox"
                      checked={rule.active}
                      disabled={!canManage}
                      onChange={() => toggleActive(rule)}
                      className="h-4 w-4 accent-[#16a34a] disabled:opacity-50"
                    />
                    {rule.active ? 'Active' : 'Inactive'}
                  </label>
                  {canManage && (
                    <>
                      <button onClick={() => openEdit(rule)} className="rounded p-1 text-[#475569] hover:bg-[#e2e8f0]" aria-label={`Edit ${rule.name}`}>
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => setDeletingRule(rule)} className="rounded p-1 text-[#dc2626] hover:bg-[#fee2e2]" aria-label={`Delete ${rule.name}`}>
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} title={editingRule ? 'Edit rule' : 'New rule'} onClose={() => setModalOpen(false)} widthClassName="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label="Rule name" htmlFor="rule-name" error={errors.name?.message} required>
            <input id="rule-name" className={inputClassName} {...register('name')} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Regulation" htmlFor="rule-regulation" error={errors.regulationId?.message} required>
              <select id="rule-regulation" className={inputClassName} disabled={!!editingRule} {...register('regulationId')}>
                {regulations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Rule type" htmlFor="rule-type" error={errors.type?.message} required>
              <select id="rule-type" className={inputClassName} {...register('type')}>
                {ruleTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-[#475569]">Conditions (all must match)</p>
            <button
              type="button"
              onClick={() => append({ field: '', operator: 'gte', value: '' })}
              className="flex items-center gap-1 text-xs font-semibold text-[#4f46e5]"
            >
              <Plus size={13} /> Add condition
            </button>
          </div>
          {errors.conditions?.root?.message && <p className="mb-2 text-[11px] font-semibold text-[#dc2626]">{errors.conditions.root.message}</p>}
          <div className="mb-4 space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <input
                  placeholder="field, e.g. attendancePercent"
                  className={`${inputClassName} flex-[1.3]`}
                  {...register(`conditions.${index}.field` as const)}
                />
                <select className={`${inputClassName} flex-1`} {...register(`conditions.${index}.operator` as const)}>
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.label}
                    </option>
                  ))}
                </select>
                <input placeholder="value" className={`${inputClassName} flex-1`} {...register(`conditions.${index}.value` as const)} />
                <button
                  type="button"
                  onClick={() => fields.length > 1 && remove(index)}
                  disabled={fields.length === 1}
                  className="mt-2.5 shrink-0 text-[#94a3b8] hover:text-[#dc2626] disabled:opacity-30"
                  aria-label="Remove condition"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>

          <FormField label="Outcome" htmlFor="rule-outcome" error={errors.outcome?.message} hint="What happens when all conditions above are satisfied." required>
            <input id="rule-outcome" className={inputClassName} {...register('outcome')} />
          </FormField>

          <label className="mb-4 flex items-center gap-2 text-xs font-semibold text-[#475569]">
            <input type="checkbox" className="h-4 w-4 accent-[#16a34a]" {...register('active')} />
            Active immediately
          </label>

          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9]">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-70">
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              {editingRule ? 'Save changes' : 'Create rule'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deletingRule}
        title="Delete rule"
        description={`Delete "${deletingRule?.name ?? ''}"? Regulations referencing it will no longer evaluate this condition.`}
        confirmLabel="Delete rule"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingRule(null)}
      />
    </div>
  )
}
