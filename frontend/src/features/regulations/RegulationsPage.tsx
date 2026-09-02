import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Eye, Edit2, Trash2, AlertCircle, Loader2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import FormField, { inputClassName, inputErrorClassName } from '@/components/ui/FormField'
import * as regulationsApi from '@/api/regulations'
import * as programsApi from '@/api/programs'
import { ApiRequestError } from '@/api/client'
import type { RegulationWithRuleCount } from '@/api/regulations'
import type { Program } from '@/types'

const schema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters.'),
  code: z.string().min(3, 'Code is required.').toUpperCase(),
  programId: z.string().min(1, 'Select a program.'),
  effectiveDate: z.string().min(1, 'Effective date is required.'),
  description: z.string().min(10, 'Add at least a short description (10+ characters).'),
})

type FormValues = z.infer<typeof schema>

export default function RegulationsPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { user } = useAuth()
  const canManage = user?.role === 'super_admin' || user?.role === 'registrar'

  const [regulations, setRegulations] = useState<RegulationWithRuleCount[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRegulation, setEditingRegulation] = useState<RegulationWithRuleCount | null>(null)
  const [deletingRegulation, setDeletingRegulation] = useState<RegulationWithRuleCount | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function loadData() {
    setLoading(true)
    setLoadError('')
    try {
      const [regs, progs] = await Promise.all([regulationsApi.list(), programsApi.list()])
      setRegulations(regs)
      setPrograms(progs)
    } catch (err) {
      setLoadError(err instanceof ApiRequestError ? err.message : 'Failed to load regulations.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return regulations.filter((reg) => {
      const matchesSearch = !q || reg.name.toLowerCase().includes(q) || reg.code.toLowerCase().includes(q)
      const matchesStatus = filterStatus === 'all' || reg.status === filterStatus
      return matchesSearch && matchesStatus
    })
  }, [regulations, searchQuery, filterStatus])

  function programName(programId: string) {
    return programs.find((p) => p.id === programId)?.name ?? 'Unknown program'
  }

  function openCreate() {
    setEditingRegulation(null)
    reset({ name: '', code: '', programId: programs[0]?.id ?? '', effectiveDate: '', description: '' })
    setModalOpen(true)
  }

  function openEdit(reg: RegulationWithRuleCount) {
    setEditingRegulation(reg)
    reset({ name: reg.name, code: reg.code, programId: reg.programId, effectiveDate: reg.effectiveDate, description: reg.description })
    setModalOpen(true)
  }

  async function onSubmit(values: FormValues) {
    try {
      if (editingRegulation) {
        const updated = await regulationsApi.update(editingRegulation.id, values)
        setRegulations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
        showToast(`${updated.name} updated.`)
      } else {
        const created = await regulationsApi.create(values)
        setRegulations((prev) => [created, ...prev])
        showToast(`${created.name} created as draft.`)
      }
      setModalOpen(false)
    } catch (err) {
      const formFields: (keyof FormValues)[] = ['name', 'code', 'programId', 'effectiveDate', 'description']
      if (err instanceof ApiRequestError && err.fieldErrors) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (formFields.includes(field as keyof FormValues)) {
            setError(field as keyof FormValues, { message })
          }
        }
      } else {
        showToast(err instanceof ApiRequestError ? err.message : 'Something went wrong.', 'error')
      }
    }
  }

  async function confirmDelete() {
    if (!deletingRegulation) return
    try {
      await regulationsApi.remove(deletingRegulation.id)
      setRegulations((prev) => prev.filter((r) => r.id !== deletingRegulation.id))
      showToast(`${deletingRegulation.name} deleted.`)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to delete regulation.', 'error')
    } finally {
      setDeletingRegulation(null)
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
        <EmptyState
          icon={AlertCircle}
          title="Couldn't load regulations"
          description={loadError}
          action={{ label: 'Retry', onClick: loadData }}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-8 sm:px-9 lg:px-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#4f46e5]">Policy Management</p>
          <h1 className="font-display text-[32px] font-bold tracking-[-0.04em] text-[#0f172a]">Academic Regulations</h1>
          <p className="mt-2 text-sm text-[#64748b]">Create, manage, and publish academic policies and regulations.</p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex w-fit items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1e293b]"
          >
            <Plus size={15} /> Create regulation
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <div className="flex items-center gap-2 border-b border-[#cbd5e1] px-3 py-2 text-[#64748b]">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search regulations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-[#0f172a] placeholder-[#94a3b8] outline-none"
            />
          </div>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded border border-[#e2e8f0] bg-[#ffffff] px-3 py-2 text-xs text-[#475569] outline-none"
        >
          <option value="all">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="review">Under Review</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div className="border border-[#e2e8f0] bg-[#ffffff] p-4">
          <p className="text-xs font-semibold text-[#64748b]">Total Regulations</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#0f172a]">{regulations.length}</p>
        </div>
        <div className="border border-[#e2e8f0] bg-[#ffffff] p-4">
          <p className="text-xs font-semibold text-[#64748b]">Published</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#16a34a]">
            {regulations.filter((r) => r.status === 'published').length}
          </p>
        </div>
        <div className="border border-[#e2e8f0] bg-[#ffffff] p-4">
          <p className="text-xs font-semibold text-[#64748b]">In Review</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#dc2626]">
            {regulations.filter((r) => r.status === 'review').length}
          </p>
        </div>
        <div className="border border-[#e2e8f0] bg-[#ffffff] p-4">
          <p className="text-xs font-semibold text-[#64748b]">Total Rules</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#0f172a]">
            {regulations.reduce((sum, r) => sum + r.ruleCount, 0)}
          </p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="No regulations found"
          description="Try adjusting your search or filters, or create a new regulation."
          action={{
            label: 'Clear filters',
            onClick: () => {
              setSearchQuery('')
              setFilterStatus('all')
            },
          }}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((reg) => (
            <div key={reg.id} className="border border-[#e2e8f0] bg-[#ffffff] p-5 transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <h3 className="font-semibold text-[#0f172a]">{reg.name}</h3>
                    <StatusBadge status={reg.status} />
                  </div>
                  <p className="mb-3 text-xs text-[#94a3b8]">
                    Code: <span className="font-mono font-semibold">{reg.code}</span> · Version: {reg.version} ·{' '}
                    {reg.ruleCount} rules · {programName(reg.programId)}
                  </p>
                  <div className="grid gap-4 text-xs text-[#64748b] sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-[#64748b]">Effective Date</p>
                      <p className="mt-1 font-semibold text-[#475569]">{reg.effectiveDate}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-[#64748b]">Last Modified</p>
                      <p className="mt-1 font-semibold text-[#475569]">{reg.lastModified}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-[#64748b]">Approval stage</p>
                      <p className="mt-1 font-semibold capitalize text-[#475569]">
                        {reg.approvalHistory[reg.approvalHistory.length - 1]?.step.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="ml-4 flex gap-2">
                  <button
                    onClick={() => navigate(`/regulations/${reg.id}`)}
                    className="rounded p-1 text-[#475569] hover:bg-[#e2e8f0]"
                    title="View"
                    aria-label={`View ${reg.name}`}
                  >
                    <Eye size={16} />
                  </button>
                  {canManage && (
                    <>
                      <button
                        onClick={() => openEdit(reg)}
                        className="rounded p-1 text-[#475569] hover:bg-[#e2e8f0]"
                        title="Edit"
                        aria-label={`Edit ${reg.name}`}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeletingRegulation(reg)}
                        className="rounded p-1 text-[#dc2626] hover:bg-[#fee2e2]"
                        title="Delete"
                        aria-label={`Delete ${reg.name}`}
                      >
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

      <Modal
        open={modalOpen}
        title={editingRegulation ? 'Edit regulation' : 'Create regulation'}
        description={editingRegulation ? undefined : 'New regulations start in draft status.'}
        onClose={() => setModalOpen(false)}
        widthClassName="max-w-xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label="Regulation name" htmlFor="reg-name" error={errors.name?.message} required>
            <input id="reg-name" className={errors.name ? inputErrorClassName : inputClassName} {...register('name')} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Code" htmlFor="reg-code" error={errors.code?.message} required>
              <input id="reg-code" className={errors.code ? inputErrorClassName : inputClassName} {...register('code')} />
            </FormField>
            <FormField label="Effective date" htmlFor="reg-date" error={errors.effectiveDate?.message} required>
              <input id="reg-date" type="date" className={errors.effectiveDate ? inputErrorClassName : inputClassName} {...register('effectiveDate')} />
            </FormField>
          </div>
          <FormField label="Program" htmlFor="reg-program" error={errors.programId?.message} required>
            <select id="reg-program" className={inputClassName} {...register('programId')}>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Description" htmlFor="reg-description" error={errors.description?.message} required>
            <textarea id="reg-description" rows={3} className={errors.description ? inputErrorClassName : inputClassName} {...register('description')} />
          </FormField>
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9]">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-70">
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              {editingRegulation ? 'Save changes' : 'Create regulation'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deletingRegulation}
        title="Delete regulation"
        description={`Delete ${deletingRegulation?.name ?? ''} and its ${deletingRegulation?.ruleCount ?? 0} associated rules? This cannot be undone.`}
        confirmLabel="Delete regulation"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingRegulation(null)}
      />
    </div>
  )
}
