import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Copy, Loader2, Plus, Search, Edit2, Trash2, UserRound } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import FormField, { inputClassName, inputErrorClassName } from '@/components/ui/FormField'
import * as usersApi from '@/api/users'
import * as departmentsApi from '@/api/departments'
import { ApiRequestError } from '@/api/client'
import type { AuthUser, Department, Role } from '@/types'

const roleLabels: Record<Role, string> = {
  super_admin: 'Super Admin',
  registrar: 'Registrar',
  hod: 'HOD',
  faculty: 'Faculty',
  student: 'Student',
}

const roleBadgeClasses: Record<Role, string> = {
  super_admin: 'bg-[#0f172a] text-white',
  registrar: 'bg-[#fffbeb] text-[#92400e]',
  hod: 'bg-[#dbeafe] text-[#2563eb]',
  faculty: 'bg-[#dcfce7] text-[#16a34a]',
  student: 'bg-[#fef3c7] text-[#d97706]',
}

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().min(1, 'Email is required.').email('Enter a valid email address.'),
  role: z.enum(['super_admin', 'registrar', 'hod', 'faculty', 'student']),
  departmentId: z.string().optional(),
})

type FormValues = z.infer<typeof schema>
const formFields: (keyof FormValues)[] = ['name', 'email', 'role', 'departmentId']

export default function UsersPage() {
  const { showToast } = useToast()
  const { user: currentUser } = useAuth()
  const isHod = currentUser?.role === 'hod'
  const canManage = currentUser?.role === 'super_admin' || currentUser?.role === 'registrar' || isHod

  const [users, setUsers] = useState<AuthUser[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null)
  const [deletingUser, setDeletingUser] = useState<AuthUser | null>(null)
  const [newCredential, setNewCredential] = useState<{ name: string; email: string; tempPassword: string } | null>(null)

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
      const [userRows, departmentRows] = await Promise.all([usersApi.list(), departmentsApi.list()])
      setUsers(userRows)
      setDepartments(departmentRows)
    } catch (err) {
      setLoadError(err instanceof ApiRequestError ? err.message : 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function departmentIdForName(name?: string) {
    return departments.find((d) => d.name === name)?.id ?? ''
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return users.filter((u) => {
      const matchesSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      const matchesRole = filterRole === 'all' || u.role === filterRole
      return matchesSearch && matchesRole
    })
  }, [users, searchQuery, filterRole])

  function openInvite() {
    setEditingUser(null)
    const myDeptId = isHod ? departmentIdForName(currentUser?.department) : ''
    reset({ name: '', email: '', role: 'faculty', departmentId: myDeptId })
    setModalOpen(true)
  }

  function openEdit(u: AuthUser) {
    setEditingUser(u)
    reset({ name: u.name, email: u.email, role: u.role, departmentId: departmentIdForName(u.department) })
    setModalOpen(true)
  }

  async function onSubmit(values: FormValues) {
    try {
      const payload = { ...values }
      if (isHod) {
        payload.role = 'faculty'
        payload.departmentId = departmentIdForName(currentUser?.department)
      }

      if (editingUser) {
        const updated = await usersApi.update(editingUser.id, payload)
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
        showToast(`${updated.name} updated.`)
        setModalOpen(false)
      } else {
        const { user: created, tempPassword } = await usersApi.create(payload)
        setUsers((prev) => [created, ...prev])
        setModalOpen(false)
        setNewCredential({ name: created.name, email: created.email, tempPassword })
      }
    } catch (err) {
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
    if (!deletingUser) return
    try {
      await usersApi.remove(deletingUser.id)
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id))
      showToast(`${deletingUser.name} removed.`)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to remove user.', 'error')
    } finally {
      setDeletingUser(null)
    }
  }

  async function copyTempPassword() {
    if (!newCredential) return
    try {
      await navigator.clipboard.writeText(newCredential.tempPassword)
      showToast('Temporary password copied.')
    } catch {
      showToast('Could not copy — select and copy it manually.', 'error')
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
        <EmptyState icon={AlertCircle} title="Couldn't load users" description={loadError} action={{ label: 'Retry', onClick: loadData }} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-8 sm:px-9 lg:px-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#4f46e5]">Access Control</p>
          <h1 className="font-display text-[32px] font-bold tracking-[-0.04em] text-[#0f172a]">Users &amp; Roles</h1>
          <p className="mt-2 text-sm text-[#64748b]">Manage who can view, edit, and approve regulations.</p>
        </div>
        {canManage && (
          <button
            onClick={openInvite}
            className="flex w-fit items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1e293b]"
          >
            <Plus size={15} /> Invite user
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <div className="flex items-center gap-2 border-b border-[#cbd5e1] px-3 py-2 text-[#64748b]">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-[#0f172a] placeholder-[#94a3b8] outline-none"
            />
          </div>
        </div>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="rounded border border-[#e2e8f0] bg-[#ffffff] px-3 py-2 text-xs text-[#475569] outline-none">
          <option value="all">All roles</option>
          {Object.entries(roleLabels).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={UserRound} title="No users found" description="Try a different search or filter, or invite a new user." action={canManage ? { label: 'Invite user', onClick: openInvite } : { label: 'Clear filters', onClick: () => { setSearchQuery(''); setFilterRole('all') } }} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#ffffff]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f1f5f9]">
                  <th className="px-5 py-3 text-left font-semibold text-[#475569]">User</th>
                  <th className="px-5 py-3 text-left font-semibold text-[#475569]">Role</th>
                  <th className="px-5 py-3 text-left font-semibold text-[#475569]">Department</th>
                  {canManage && <th className="px-5 py-3 text-center font-semibold text-[#475569]">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f8fafc]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f59e0b] text-xs font-bold text-[#1e293b]">
                          {u.avatarInitials}
                        </div>
                        <div>
                          <p className="font-semibold text-[#0f172a]">
                            {u.name} {u.id === currentUser?.id && <span className="text-[10px] font-normal text-[#94a3b8]">(you)</span>}
                          </p>
                          <p className="text-xs text-[#94a3b8]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${roleBadgeClasses[u.role]}`}>{roleLabels[u.role]}</span>
                    </td>
                    <td className="px-5 py-4 text-[#475569]">{u.department ?? '—'}</td>
                    {canManage && (
                      <td className="px-5 py-4">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => openEdit(u)} className="rounded p-1 text-[#475569] hover:bg-[#e2e8f0]" aria-label={`Edit ${u.name}`}>
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeletingUser(u)}
                            disabled={u.id === currentUser?.id}
                            className="rounded p-1 text-[#dc2626] hover:bg-[#fee2e2] disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label={`Remove ${u.name}`}
                            title={u.id === currentUser?.id ? "You can't remove your own account" : 'Remove user'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} title={editingUser ? 'Edit user' : 'Invite user'} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label="Full name" htmlFor="user-name" error={errors.name?.message} required>
            <input id="user-name" className={errors.name ? inputErrorClassName : inputClassName} {...register('name')} />
          </FormField>
          <FormField label="Email" htmlFor="user-email" error={errors.email?.message} required>
            <input id="user-email" type="email" className={errors.email ? inputErrorClassName : inputClassName} {...register('email')} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Role" htmlFor="user-role" error={errors.role?.message} required>
              <select id="user-role" className={inputClassName} {...register('role')} disabled={isHod}>
                {isHod ? (
                  <option value="faculty">Faculty</option>
                ) : (
                  Object.entries(roleLabels).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))
                )}
              </select>
            </FormField>
            <FormField label="Department" htmlFor="user-department">
              <select id="user-department" className={inputClassName} {...register('departmentId')} disabled={isHod}>
                {!isHod && <option value="">None</option>}
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          {isHod && (
            <p className="-mt-2 mb-3 text-[11px] font-medium text-[#4f46e5]">
              As Head of Department, you can add Faculty members to {currentUser?.department ?? 'your department'}.
            </p>
          )}
          {!editingUser && (
            <p className="mb-4 text-[11px] text-[#94a3b8]">
              A temporary password is generated automatically — you'll see it once, right after creating this user.
            </p>
          )}
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9]">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-70">
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              {editingUser ? 'Save changes' : 'Send invite'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!newCredential}
        title="User created"
        description="Share this one-time password with them securely — it won't be shown again."
        onClose={() => setNewCredential(null)}
        widthClassName="max-w-sm"
      >
        {newCredential && (
          <div>
            <p className="text-sm text-[#0f172a]">
              <span className="font-semibold">{newCredential.name}</span> ({newCredential.email})
            </p>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2.5">
              <code className="text-sm font-semibold text-[#0f172a]">{newCredential.tempPassword}</code>
              <button onClick={copyTempPassword} className="flex items-center gap-1 text-xs font-semibold text-[#475569] hover:text-[#0f172a]" aria-label="Copy temporary password">
                <Copy size={14} /> Copy
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setNewCredential(null)} className="rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b]">
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deletingUser}
        title="Remove user"
        description={`Remove ${deletingUser?.name ?? ''}'s access to RuleCraft?`}
        confirmLabel="Remove access"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingUser(null)}
      />
    </div>
  )
}
