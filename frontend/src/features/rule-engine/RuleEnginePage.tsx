import { useEffect, useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import type { Control, UseFormRegister, UseFormSetValue } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, ArrowRight, GitBranch, Plus, Search, Edit2, Trash2, X, Loader2, Sparkles } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import FormField, { inputClassName } from '@/components/ui/FormField'
import ToggleSwitch from '@/components/ui/ToggleSwitch'
import * as rulesApi from '@/api/rules'
import * as regulationsApi from '@/api/regulations'
import { ApiRequestError } from '@/api/client'
import { operatorSymbols } from '@/utils/conditionTree'
import type { RegulationWithRuleCount } from '@/api/regulations'
import type { ConditionGroup, ConditionNode, Rule, RuleType } from '@/types'

export const COMMON_RULE_FIELDS = [
  { id: 'grade', label: 'grade', desc: 'Letter Grade (A, B, C, F)', defaultOp: 'eq', defaultVal: 'A', example: 'grade = A' },
  { id: 'marks', label: 'marks', desc: 'Marks / Score (0-100)', defaultOp: 'gte', defaultVal: '40', example: 'marks >= 40' },
  { id: 'subjectMarks', label: 'subjectMarks', desc: 'Subject Marks (0-100)', defaultOp: 'gte', defaultVal: '40', example: 'subjectMarks >= 40' },
  { id: 'cgpa', label: 'cgpa', desc: 'CGPA (0.0 - 10.0)', defaultOp: 'gte', defaultVal: '5.0', example: 'cgpa >= 5.0' },
  { id: 'gpa', label: 'gpa', desc: 'GPA (0.0 - 4.0 / 10.0)', defaultOp: 'gte', defaultVal: '3.0', example: 'gpa >= 3.0' },
  { id: 'attendancePercent', label: 'attendancePercent', desc: 'Attendance % (0-100)', defaultOp: 'gte', defaultVal: '75', example: 'attendancePercent >= 75' },
  { id: 'activeBacklogs', label: 'activeBacklogs', desc: 'Active Backlogs count', defaultOp: 'lte', defaultVal: '2', example: 'activeBacklogs <= 2' },
  { id: 'credits', label: 'credits', desc: 'Credits Earned', defaultOp: 'gte', defaultVal: '20', example: 'credits >= 20' },
  { id: 'shortfallMarks', label: 'shortfallMarks', desc: 'Grace Marks Shortfall', defaultOp: 'lte', defaultVal: '5', example: 'shortfallMarks <= 5' },
  { id: 'medicalCertificate', label: 'medicalCertificate', desc: 'Medical Cert (true/false)', defaultOp: 'eq', defaultVal: 'true', example: 'medicalCertificate = true' },
] as const

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

const leafConditionSchema = z.object({
  type: z.literal('condition'),
  field: z.string().min(1, 'Field is required.'),
  operator: z.enum(['gte', 'lte', 'gt', 'lt', 'eq', 'neq']),
  value: z.string().min(1, 'Value is required.'),
})

// Recursive: a group's children can themselves be leaves or nested groups.
// z.lazy() is what makes a schema able to reference itself.
const conditionNodeSchema: z.ZodType<ConditionNode> = z.lazy(() =>
  z.union([
    leafConditionSchema,
    z.object({
      type: z.literal('group'),
      operator: z.enum(['AND', 'OR']),
      children: z.array(conditionNodeSchema).min(1, 'A group needs at least one condition.'),
    }),
  ]),
)

const schema = z.object({
  name: z.string().min(3, 'Rule name must be at least 3 characters.'),
  regulationId: z.string().min(1, 'Select a regulation.'),
  type: z.enum(['attendance', 'passing', 'grading', 'promotion', 'backlog', 'grace_marks']),
  outcome: z.string().min(3, 'Describe the outcome.'),
  active: z.boolean(),
  conditionTree: conditionNodeSchema,
})

type FormValues = z.infer<typeof schema>
const topLevelFields: (keyof FormValues)[] = ['name', 'regulationId', 'type', 'outcome', 'active']

// The builder's root is always rendered as a group (even a single plain
// condition becomes a one-child AND group) — much simpler editor than
// letting the root itself be a bare leaf, and evaluates identically either
// way since a one-child AND group and its lone child mean the same thing.
function normalizeToGroup(node: ConditionNode): ConditionGroup {
  return node.type === 'group' ? node : { type: 'group', operator: 'AND', children: [node] }
}

const emptyCondition = { type: 'condition' as const, field: '', operator: 'gte' as const, value: '' }

interface ConditionGroupEditorProps {
  control: Control<FormValues>
  register: UseFormRegister<FormValues>
  setValue?: UseFormSetValue<FormValues>
  path: string
  depth: number
}

// Recursive condition-tree builder. RHF's Path<FormValues> type can't
// express an arbitrarily-deep dynamic path, so this component (only this
// component) works with loosely-typed paths and casts at the register/
// useFieldArray boundary — everywhere else in the form stays fully typed.
function ConditionGroupEditor({ control, register, setValue, path, depth }: ConditionGroupEditorProps) {
  const { fields, append, remove } = useFieldArray({ control, name: `${path}.children` as 'conditionTree.children' })

  return (
    <div className={depth > 0 ? 'ml-2 border-l-2 border-[#e2e8f0] pl-4' : ''}>
      <datalist id="rule-common-fields">
        {COMMON_RULE_FIELDS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.desc} ({f.example})
          </option>
        ))}
      </datalist>

      <div className="mb-2 flex items-center gap-2">
        <select
          {...register(`${path}.operator` as 'conditionTree.operator')}
          className="rounded border border-[#e0e7ff] bg-[#eef2ff] px-2 py-1 text-xs font-bold text-[#4f46e5] outline-none"
        >
          <option value="AND">AND</option>
          <option value="OR">OR</option>
        </select>
        <span className="text-[10px] text-[#94a3b8]">of the following must match</span>
      </div>
      <div className="space-y-3">
        {fields.map((field, index) => {
          const childPath = `${path}.children.${index}`
          const isGroup = (field as unknown as ConditionNode).type === 'group'
          return (
            <div key={field.id} className="space-y-1.5">
              <div className="flex items-start gap-2">
                {isGroup ? (
                  <div className="flex-1 rounded border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-3">
                    <ConditionGroupEditor control={control} register={register} setValue={setValue} path={childPath} depth={depth + 1} />
                  </div>
                ) : (
                  <>
                    <input
                      list="rule-common-fields"
                      placeholder="field (e.g. grade, marks, cgpa)"
                      className={`${inputClassName} flex-[1.3]`}
                      {...register(`${childPath}.field` as 'conditionTree.children.0.field')}
                    />
                    <select className={`${inputClassName} flex-1`} {...register(`${childPath}.operator` as 'conditionTree.children.0.operator')}>
                      {operators.map((op) => (
                        <option key={op.id} value={op.id}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="value (e.g. A, 40, 7.5)"
                      className={`${inputClassName} flex-1`}
                      {...register(`${childPath}.value` as 'conditionTree.children.0.value')}
                    />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => fields.length > 1 && remove(index)}
                  disabled={fields.length === 1}
                  className="mt-2.5 shrink-0 text-[#94a3b8] hover:text-[#dc2626] disabled:opacity-30"
                  aria-label="Remove"
                >
                  <X size={16} />
                </button>
              </div>

              {!isGroup && (
                <div className="flex flex-wrap items-center gap-1 pl-0.5 text-[11px] text-[#64748b]">
                  <span className="text-[10px] uppercase tracking-wider text-[#94a3b8]">Quick set:</span>
                  {COMMON_RULE_FIELDS.slice(0, 5).map((cf) => (
                    <button
                      key={cf.id}
                      type="button"
                      onClick={() => {
                        if (setValue) {
                          setValue(`${childPath}.field` as 'conditionTree.children.0.field', cf.id, { shouldValidate: true })
                          setValue(`${childPath}.operator` as 'conditionTree.children.0.operator', cf.defaultOp as 'gte', { shouldValidate: true })
                          setValue(`${childPath}.value` as 'conditionTree.children.0.value', cf.defaultVal, { shouldValidate: true })
                        }
                      }}
                      className="rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[10px] font-medium text-[#475569] transition hover:bg-[#e0e7ff] hover:text-[#4338ca]"
                      title={cf.desc}
                    >
                      {cf.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-3">
        <button type="button" onClick={() => append(emptyCondition)} className="flex items-center gap-1 text-xs font-semibold text-[#4f46e5]">
          <Plus size={13} /> Condition
        </button>
        <button
          type="button"
          onClick={() => append({ type: 'group', operator: 'AND', children: [emptyCondition] })}
          className="flex items-center gap-1 text-xs font-semibold text-[#475569]"
        >
          <Plus size={13} /> Group
        </button>
      </div>
    </div>
  )
}

function ConditionTreeBadges({ node, depth = 0 }: { node: ConditionNode; depth?: number }) {
  if (node.type === 'condition') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2 py-1 font-mono text-[11px]">
        <span className="text-[#334155]">{node.field}</span>
        <span className="font-bold text-[#4f46e5]">{operatorSymbols[node.operator] ?? node.operator}</span>
        <span className="font-semibold text-[#0f172a]">{node.value}</span>
      </span>
    )
  }
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${depth > 0 ? 'rounded-md border border-dashed border-[#cbd5e1] px-2 py-1' : ''}`}>
      {node.children.map((child, i) => (
        <span key={i} className="inline-flex flex-wrap items-center gap-1.5">
          {i > 0 && (
            <span className="rounded bg-[#e0e7ff] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#4f46e5]">{node.operator}</span>
          )}
          <ConditionTreeBadges node={child} depth={depth + 1} />
        </span>
      ))}
    </span>
  )
}

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
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

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
      type: 'grading',
      outcome: 'Grade A awarded',
      active: true,
      conditionTree: { type: 'group', operator: 'AND', children: [{ type: 'condition', field: 'grade', operator: 'eq', value: 'A' }] },
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
      conditionTree: normalizeToGroup(rule.conditionTree),
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
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <ConditionTreeBadges node={rule.conditionTree} />
                    <ArrowRight size={12} className="mx-0.5 shrink-0 text-[#94a3b8]" />
                    <span className="inline-flex items-center rounded-md bg-[#0f172a] px-2 py-1 text-[11px] font-semibold text-white">
                      {rule.outcome}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <ToggleSwitch
                    checked={rule.active}
                    disabled={!canManage}
                    onChange={() => toggleActive(rule)}
                    label={rule.active ? 'Active' : 'Inactive'}
                    ariaLabel={`${rule.active ? 'Deactivate' : 'Activate'} ${rule.name}`}
                  />
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
              <select
                id="rule-type"
                className={inputClassName}
                {...register('type', {
                  onChange: (e) => {
                    if (editingRule) return
                    const t = e.target.value as RuleType
                    if (t === 'grading') {
                      setValue('conditionTree.children.0.field' as 'conditionTree.children.0.field', 'marks')
                      setValue('conditionTree.children.0.operator' as 'conditionTree.children.0.operator', 'gte')
                      setValue('conditionTree.children.0.value' as 'conditionTree.children.0.value', '80')
                      setValue('outcome', 'Grade A awarded')
                    } else if (t === 'passing') {
                      setValue('conditionTree.children.0.field' as 'conditionTree.children.0.field', 'marks')
                      setValue('conditionTree.children.0.operator' as 'conditionTree.children.0.operator', 'gte')
                      setValue('conditionTree.children.0.value' as 'conditionTree.children.0.value', '40')
                      setValue('outcome', 'Subject passed')
                    } else if (t === 'promotion') {
                      setValue('conditionTree.children.0.field' as 'conditionTree.children.0.field', 'cgpa')
                      setValue('conditionTree.children.0.operator' as 'conditionTree.children.0.operator', 'gte')
                      setValue('conditionTree.children.0.value' as 'conditionTree.children.0.value', '5.0')
                      setValue('outcome', 'Eligible for promotion to next year')
                    } else if (t === 'backlog') {
                      setValue('conditionTree.children.0.field' as 'conditionTree.children.0.field', 'activeBacklogs')
                      setValue('conditionTree.children.0.operator' as 'conditionTree.children.0.operator', 'lte')
                      setValue('conditionTree.children.0.value' as 'conditionTree.children.0.value', '2')
                      setValue('outcome', 'Promoted with ATKT')
                    } else if (t === 'grace_marks') {
                      setValue('conditionTree.children.0.field' as 'conditionTree.children.0.field', 'shortfallMarks')
                      setValue('conditionTree.children.0.operator' as 'conditionTree.children.0.operator', 'lte')
                      setValue('conditionTree.children.0.value' as 'conditionTree.children.0.value', '5')
                      setValue('outcome', 'Up to 5 grace marks applied')
                    } else if (t === 'attendance') {
                      setValue('conditionTree.children.0.field' as 'conditionTree.children.0.field', 'attendancePercent')
                      setValue('conditionTree.children.0.operator' as 'conditionTree.children.0.operator', 'gte')
                      setValue('conditionTree.children.0.value' as 'conditionTree.children.0.value', '75')
                      setValue('outcome', 'Eligible to sit for semester exams')
                    }
                  },
                })}
              >
                {ruleTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <p className="mb-2 text-xs font-semibold text-[#475569]">Conditions</p>
          {errors.conditionTree && <p className="mb-2 text-[11px] font-semibold text-[#dc2626]">Fix the highlighted conditions below.</p>}
          <div className="mb-3 rounded border border-[#e2e8f0] bg-white p-3">
            <ConditionGroupEditor control={control} register={register} setValue={setValue} path="conditionTree" depth={0} />
          </div>

          <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-2.5 text-xs text-[#64748b]">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-[#6366f1]" />
            <span>
              <strong className="text-[#334155]">Any criteria supported:</strong> You can check score/marks (e.g. <code className="rounded bg-[#f1f5f9] px-1 font-semibold text-[#4f46e5]">marks &gt;= 75</code>), letter grades (e.g. <code className="rounded bg-[#f1f5f9] px-1 font-semibold text-[#4f46e5]">grade = A</code>), CGPA/GPA (e.g. <code className="rounded bg-[#f1f5f9] px-1 font-semibold text-[#4f46e5]">cgpa &gt;= 6.5</code>), attendance %, backlogs, or any custom field.
            </span>
          </div>

          <FormField label="Outcome" htmlFor="rule-outcome" error={errors.outcome?.message} hint="What happens when all conditions above are satisfied." required>
            <input id="rule-outcome" className={inputClassName} {...register('outcome')} />
          </FormField>

          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <div className="mb-4">
                <ToggleSwitch checked={field.value} onChange={() => field.onChange(!field.value)} label="Active immediately" />
              </div>
            )}
          />

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
