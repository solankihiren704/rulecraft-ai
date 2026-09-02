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
  super_admin: 'bg-[#102b35] text-white',
  registrar: 'bg-[#f0e3d0] text-[#8a5a20]',
  hod: 'bg-[#dceafa] text-[#2d65a1]',
  faculty: 'bg-[#d8f4ed] text-[#087f72]',
  student: 'bg-[#fff0c7] text-[#997016]',
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
  const canManage = currentUser?.role === 'super_admin'

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
    reset({ name: '', email: '', role: 'faculty', departmentId: '' })
    setModalOpen(true)
  }

  function openEdit(u: AuthUser) {
    setEditingUser(u)
    reset({ name: u.name, email: u.email, role: u.role, departmentId: departmentIdForName(u.department) })
    setModalOpen(true)
  }

  async function onSubmit(values: FormValues) {
    try {
      if (editingUser) {
        const updated = await usersApi.update(editingUser.id, values)
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
        showToast(`${updated.name} updated.`)
        setModalOpen(false)
      } else {
        const { user: created, tempPassword } = await usersApi.create(values)
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
        <Loader2 className="animate-spin text-[#557071]" size={28} />
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
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#e17f5f]">Access Control</p>
          <h1 className="font-display text-[32px] font-bold tracking-[-0.04em] text-[#102b35]">Users &amp; Roles</h1>
          <p className="mt-2 text-sm text-[#718684]">Manage who can view, edit, and approve regulations.</p>
        </div>
        {canManage && (
          <button
            onClick={openInvite}
            className="flex w-fit items-center gap-2 rounded-lg bg-[#102b35] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#204853]"
          >
            <Plus size={15} /> Invite user
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <div className="flex items-center gap-2 border-b border-[#b8c7c3] px-3 py-2 text-[#78908e]">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-[#152b35] placeholder-[#9aa8a5] outline-none"
            />
          </div>
        </div>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="rounded border border-[#e4e1da] bg-[#fbfaf7] px-3 py-2 text-xs text-[#486362] outline-none">
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
        <div className="overflow-hidden rounded-lg border border-[#e4e1da] bg-[#fbfaf7]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e4e1da] bg-[#f0eee8]">
                  <th className="px-5 py-3 text-left font-semibold text-[#486362]">User</th>
                  <th className="px-5 py-3 text-left font-semibold text-[#486362]">Role</th>
                  <th className="px-5 py-3 text-left font-semibold text-[#486362]">Department</th>
                  {canManage && <th className="px-5 py-3 text-center font-semibold text-[#486362]">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-[#e4e1da] last:border-b-0 hover:bg-[#f8f5f0]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e2b36c] text-xs font-bold text-[#193740]">
                          {u.avatarInitials}
                        </div>
                        <div>
                          <p className="font-semibold text-[#173640]">
                            {u.name} {u.id === currentUser?.id && <span className="text-[10px] font-normal text-[#9aa8a5]">(you)</span>}
                          </p>
                          <p className="text-xs text-[#9aa8a5]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${roleBadgeClasses[u.role]}`}>{roleLabels[u.role]}</span>
                    </td>
                    <td className="px-5 py-4 text-[#486362]">{u.department ?? '—'}</td>
                    {canManage && (
                      <td className="px-5 py-4">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => openEdit(u)} className="rounded p-1 text-[#557071] hover:bg-[#e4e1da]" aria-label={`Edit ${u.name}`}>
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeletingUser(u)}
                            disabled={u.id === currentUser?.id}
                            className="rounded p-1 text-[#d46f51] hover:bg-[#ffe1d8] disabled:cursor-not-allowed disabled:opacity-30"
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
              <select id="user-role" className={inputClassName} {...register('role')}>
                {Object.entries(roleLabels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Department" htmlFor="user-department">
              <select id="user-department" className={inputClassName} {...register('departmentId')}>
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          {!editingUser && (
            <p className="mb-4 text-[11px] text-[#9aa8a5]">
              A temporary password is generated automatically — you'll see it once, right after creating this user.
            </p>
          )}
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-[#e4e1da] px-4 py-2 text-xs font-semibold text-[#486362] hover:bg-[#f0eee8]">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 rounded-lg bg-[#102b35] px-4 py-2 text-xs font-semibold text-white hover:bg-[#204853] disabled:opacity-70">
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
            <p className="text-sm text-[#173640]">
              <span className="font-semibold">{newCredential.name}</span> ({newCredential.email})
            </p>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#e4e1da] bg-white px-3 py-2.5">
              <code className="text-sm font-semibold text-[#102b35]">{newCredential.tempPassword}</code>
              <button onClick={copyTempPassword} className="flex items-center gap-1 text-xs font-semibold text-[#557071] hover:text-[#173640]" aria-label="Copy temporary password">
                <Copy size={14} /> Copy
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setNewCredential(null)} className="rounded-lg bg-[#102b35] px-4 py-2 text-xs font-semibold text-white hover:bg-[#204853]">
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
