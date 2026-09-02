import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Plus, Search, Download, Eye, Edit2, Trash2, Loader2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import FormField, { inputClassName, inputErrorClassName } from '@/components/ui/FormField'
import * as studentsApi from '@/api/students'
import * as programsApi from '@/api/programs'
import { ApiRequestError } from '@/api/client'
import type { Program, Student } from '@/types'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().min(1, 'Email is required.').email('Enter a valid email address.'),
  studentId: z.string().min(3, 'Student ID is required.'),
  programId: z.string().min(1, 'Select a program.'),
  year: z.coerce.number().min(1).max(6),
  status: z.enum(['active', 'suspended', 'graduated']),
  gpa: z.coerce.number().min(0, 'GPA cannot be negative.').max(10, 'GPA cannot exceed 10.'),
})

type FormValues = z.infer<typeof schema>
const PAGE_SIZE = 5
const formFields: (keyof FormValues)[] = ['name', 'email', 'studentId', 'programId', 'year', 'status', 'gpa']

function downloadCsv(students: Student[], programName: (id: string) => string) {
  const header = ['Name', 'Email', 'Student ID', 'Program', 'Year', 'Status', 'GPA', 'Enrolled']
  const rows = students.map((s) => [s.name, s.email, s.studentId, programName(s.programId), s.year, s.status, s.gpa.toFixed(2), s.enrollDate])
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
  const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `students-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function StudentsPage() {
  const { showToast } = useToast()
  const { user } = useAuth()
  const canManage = user?.role === 'super_admin' || user?.role === 'registrar'

  const [students, setStudents] = useState<Student[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [filterYear, setFilterYear] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null)
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null)
  const [isExporting, setIsExporting] = useState(false)

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
      const [studentRows, programRows] = await Promise.all([studentsApi.list(), programsApi.list()])
      setStudents(studentRows)
      setPrograms(programRows)
    } catch (err) {
      setLoadError(err instanceof ApiRequestError ? err.message : 'Failed to load students.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function programName(programId: string) {
    return programs.find((p) => p.id === programId)?.name ?? 'Unknown program'
  }

  const filtered = useMemo(() => {
    return students.filter((student) => {
      const q = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !q ||
        student.name.toLowerCase().includes(q) ||
        student.email.toLowerCase().includes(q) ||
        student.studentId.toLowerCase().includes(q)
      const matchesYear = filterYear === 'all' || student.year === Number(filterYear)
      const matchesStatus = filterStatus === 'all' || student.status === filterStatus
      return matchesSearch && matchesYear && matchesStatus
    })
  }, [students, searchQuery, filterYear, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function resetFilters() {
    setSearchQuery('')
    setFilterYear('all')
    setFilterStatus('all')
    setPage(1)
  }

  function openCreate() {
    setEditingStudent(null)
    reset({ name: '', email: '', studentId: '', programId: programs[0]?.id ?? '', year: 1, status: 'active', gpa: 0 })
    setModalOpen(true)
  }

  function openEdit(student: Student) {
    setEditingStudent(student)
    reset({
      name: student.name,
      email: student.email,
      studentId: student.studentId,
      programId: student.programId,
      year: student.year,
      status: student.status,
      gpa: student.gpa,
    })
    setModalOpen(true)
  }

  async function onSubmit(values: FormValues) {
    try {
      if (editingStudent) {
        const updated = await studentsApi.update(editingStudent.id, values)
        setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        showToast(`${updated.name} updated successfully.`)
      } else {
        const created = await studentsApi.create(values)
        setStudents((prev) => [created, ...prev])
        showToast(`${created.name} added successfully.`)
        setPage(1)
      }
      setModalOpen(false)
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
    if (!deletingStudent) return
    try {
      await studentsApi.remove(deletingStudent.id)
      setStudents((prev) => prev.filter((s) => s.id !== deletingStudent.id))
      showToast(`${deletingStudent.name} removed.`)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to remove student.', 'error')
    } finally {
      setDeletingStudent(null)
    }
  }

  function exportStudents() {
    setIsExporting(true)
    try {
      downloadCsv(filtered, programName)
      showToast(`Exported ${filtered.length} students to CSV.`)
    } catch {
      showToast('Failed to export students.', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const avgGpa = students.length ? (students.reduce((sum, s) => sum + s.gpa, 0) / students.length).toFixed(2) : '0.00'

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
        <EmptyState icon={AlertCircle} title="Couldn't load students" description={loadError} action={{ label: 'Retry', onClick: loadData }} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-8 sm:px-9 lg:px-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#4f46e5]">Student Management</p>
          <h1 className="font-display text-[32px] font-bold tracking-[-0.04em] text-[#0f172a]">Students</h1>
          <p className="mt-2 text-sm text-[#64748b]">Manage and monitor all enrolled students across programs.</p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex w-fit items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1e293b]"
          >
            <Plus size={15} /> Add student
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <div className="flex items-center gap-2 border-b border-[#cbd5e1] px-3 py-2 text-[#64748b]">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by name, email, or student ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              className="flex-1 bg-transparent text-sm text-[#0f172a] placeholder-[#94a3b8] outline-none"
            />
          </div>
        </div>
        <select
          value={filterYear}
          onChange={(e) => {
            setFilterYear(e.target.value)
            setPage(1)
          }}
          className="rounded border border-[#e2e8f0] bg-[#ffffff] px-3 py-2 text-xs text-[#475569] outline-none"
        >
          <option value="all">All Years</option>
          <option value="1">Year 1</option>
          <option value="2">Year 2</option>
          <option value="3">Year 3</option>
          <option value="4">Year 4</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value)
            setPage(1)
          }}
          className="rounded border border-[#e2e8f0] bg-[#ffffff] px-3 py-2 text-xs text-[#475569] outline-none"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="graduated">Graduated</option>
        </select>
        <button
          onClick={exportStudents}
          disabled={isExporting || filtered.length === 0}
          className="flex items-center gap-2 rounded border border-[#e2e8f0] bg-[#ffffff] px-3 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-60"
        >
          {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {isExporting ? 'Exporting...' : 'Export'}
        </button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="border border-[#e2e8f0] bg-[#ffffff] p-4">
          <p className="text-xs font-semibold text-[#64748b]">Total Students</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#0f172a]">{students.length}</p>
        </div>
        <div className="border border-[#e2e8f0] bg-[#ffffff] p-4">
          <p className="text-xs font-semibold text-[#64748b]">Active</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#16a34a]">
            {students.filter((s) => s.status === 'active').length}
          </p>
        </div>
        <div className="border border-[#e2e8f0] bg-[#ffffff] p-4">
          <p className="text-xs font-semibold text-[#64748b]">Avg. GPA</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#0f172a]">{avgGpa}</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No students found"
          description="Try adjusting your search or filters, or add a new student."
          action={{ label: 'Clear filters', onClick: resetFilters }}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#ffffff]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f1f5f9]">
                    <th className="px-5 py-3 text-left font-semibold text-[#475569]">Student</th>
                    <th className="px-5 py-3 text-left font-semibold text-[#475569]">ID</th>
                    <th className="px-5 py-3 text-left font-semibold text-[#475569]">Program</th>
                    <th className="px-5 py-3 text-left font-semibold text-[#475569]">Year</th>
                    <th className="px-5 py-3 text-left font-semibold text-[#475569]">Status</th>
                    <th className="px-5 py-3 text-left font-semibold text-[#475569]">GPA</th>
                    <th className="px-5 py-3 text-center font-semibold text-[#475569]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((student) => (
                    <tr key={student.id} className="border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f8fafc]">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#0f172a]">{student.name}</p>
                        <p className="text-xs text-[#94a3b8]">{student.email}</p>
                      </td>
                      <td className="px-5 py-4 text-[#475569]">{student.studentId}</td>
                      <td className="px-5 py-4 text-[#475569]">{programName(student.programId)}</td>
                      <td className="px-5 py-4 text-[#475569]">{student.year}</td>
                      <td className="px-5 py-4">
                        <StatusBadge status={student.status} />
                      </td>
                      <td className="px-5 py-4 font-semibold text-[#0f172a]">{student.gpa.toFixed(1)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => setViewingStudent(student)}
                            className="rounded p-1 text-[#475569] hover:bg-[#e2e8f0]"
                            title="View"
                            aria-label={`View ${student.name}`}
                          >
                            <Eye size={16} />
                          </button>
                          {canManage && (
                            <>
                              <button
                                onClick={() => openEdit(student)}
                                className="rounded p-1 text-[#475569] hover:bg-[#e2e8f0]"
                                title="Edit"
                                aria-label={`Edit ${student.name}`}
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => setDeletingStudent(student)}
                                className="rounded p-1 text-[#dc2626] hover:bg-[#fee2e2]"
                                title="Delete"
                                aria-label={`Delete ${student.name}`}
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between text-xs text-[#94a3b8]">
            <span>
              Showing {paged.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
              {'–'}
              {(page - 1) * PAGE_SIZE + paged.length} of {filtered.length} students
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded border border-[#e2e8f0] px-3 py-1 hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ← Previous
              </button>
              <span className="px-1 py-1">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded border border-[#e2e8f0] px-3 py-1 hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        title={editingStudent ? 'Edit student' : 'Add student'}
        description={editingStudent ? 'Update enrollment details.' : 'Enroll a new student record.'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label="Full name" htmlFor="name" error={errors.name?.message} required>
            <input id="name" className={errors.name ? inputErrorClassName : inputClassName} {...register('name')} />
          </FormField>
          <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
            <input id="email" type="email" className={errors.email ? inputErrorClassName : inputClassName} {...register('email')} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Student ID" htmlFor="studentId" error={errors.studentId?.message} required>
              <input id="studentId" className={errors.studentId ? inputErrorClassName : inputClassName} {...register('studentId')} />
            </FormField>
            <FormField label="Program" htmlFor="programId" error={errors.programId?.message} required>
              <select id="programId" className={inputClassName} {...register('programId')}>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Year" htmlFor="year" error={errors.year?.message} required>
              <select id="year" className={inputClassName} {...register('year')}>
                {[1, 2, 3, 4, 5, 6].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Status" htmlFor="status" error={errors.status?.message} required>
              <select id="status" className={inputClassName} {...register('status')}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="graduated">Graduated</option>
              </select>
            </FormField>
            <FormField label="GPA" htmlFor="gpa" error={errors.gpa?.message} required>
              <input id="gpa" type="number" step="0.1" min="0" max="10" className={errors.gpa ? inputErrorClassName : inputClassName} {...register('gpa')} />
            </FormField>
          </div>
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#1e293b] disabled:opacity-70"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {editingStudent ? 'Save changes' : 'Add student'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!viewingStudent}
        title={viewingStudent?.name ?? ''}
        description={viewingStudent?.studentId}
        onClose={() => setViewingStudent(null)}
        widthClassName="max-w-md"
      >
        {viewingStudent && (
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-[#e2e8f0] pb-2">
              <dt className="text-[#64748b]">Email</dt>
              <dd className="font-semibold text-[#0f172a]">{viewingStudent.email}</dd>
            </div>
            <div className="flex justify-between border-b border-[#e2e8f0] pb-2">
              <dt className="text-[#64748b]">Program</dt>
              <dd className="font-semibold text-[#0f172a]">{programName(viewingStudent.programId)}</dd>
            </div>
            <div className="flex justify-between border-b border-[#e2e8f0] pb-2">
              <dt className="text-[#64748b]">Year</dt>
              <dd className="font-semibold text-[#0f172a]">{viewingStudent.year}</dd>
            </div>
            <div className="flex justify-between border-b border-[#e2e8f0] pb-2">
              <dt className="text-[#64748b]">Status</dt>
              <dd>
                <StatusBadge status={viewingStudent.status} />
              </dd>
            </div>
            <div className="flex justify-between border-b border-[#e2e8f0] pb-2">
              <dt className="text-[#64748b]">GPA</dt>
              <dd className="font-semibold text-[#0f172a]">{viewingStudent.gpa.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#64748b]">Enrolled</dt>
              <dd className="font-semibold text-[#0f172a]">{viewingStudent.enrollDate}</dd>
            </div>
          </dl>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deletingStudent}
        title="Remove student"
        description={`This will permanently remove ${deletingStudent?.name ?? 'this student'} from the roster. This cannot be undone.`}
        confirmLabel="Remove student"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingStudent(null)}
      />
    </div>
  )
}
