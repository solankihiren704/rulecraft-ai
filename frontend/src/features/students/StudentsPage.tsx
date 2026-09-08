import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Plus, Search, Download, Upload, FileSpreadsheet, Eye, Edit2, Trash2, Loader2, CheckCircle2, XCircle, GraduationCap, UserCheck, Award } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import FormField, { inputClassName, inputErrorClassName } from '@/components/ui/FormField'
import * as studentsApi from '@/api/students'
import * as programsApi from '@/api/programs'
import * as departmentsApi from '@/api/departments'
import { ApiRequestError } from '@/api/client'
import { triggerBlobDownload } from '@/utils/download'
import type { ImportSummary } from '@/api/students'
import type { Department, Program, Student } from '@/types'

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

function downloadCsv(students: Student[], programName: (id: string) => string, departmentName: (id: string) => string) {
  const header = ['Name', 'Email', 'Student ID', 'Department', 'Program', 'Year', 'Status', 'GPA', 'Enrolled']
  const rows = students.map((s) => [s.name, s.email, s.studentId, departmentName(s.programId), programName(s.programId), s.year, s.status, s.gpa.toFixed(2), s.enrollDate])
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
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [filterYear, setFilterYear] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDepartment, setFilterDepartment] = useState('all')
  const [filterProgram, setFilterProgram] = useState('all')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null)
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isExportingSelected, setIsExportingSelected] = useState<studentsApi.ExportFormat | null>(null)

  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importDepartment, setImportDepartment] = useState('all')
  const [importProgram, setImportProgram] = useState('all')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportSummary | null>(null)

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
      const [studentRows, programRows, departmentRows] = await Promise.all([
        studentsApi.list(),
        programsApi.list(),
        departmentsApi.list(),
      ])
      setStudents(studentRows)
      setPrograms(programRows)
      setDepartments(departmentRows)
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

  function departmentIdForProgram(programId: string) {
    return programs.find((p) => p.id === programId)?.departmentId
  }

  function departmentName(programId: string) {
    const deptId = departmentIdForProgram(programId)
    return departments.find((d) => d.id === deptId)?.name ?? 'Unknown department'
  }

  // Programs shown in the filter/import dropdowns narrow to the selected
  // department, so picking a program can never disagree with it.
  const filterProgramOptions = useMemo(
    () => (filterDepartment === 'all' ? programs : programs.filter((p) => p.departmentId === filterDepartment)),
    [programs, filterDepartment],
  )
  const importProgramOptions = useMemo(
    () => (importDepartment === 'all' ? programs : programs.filter((p) => p.departmentId === importDepartment)),
    [programs, importDepartment],
  )

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
      const matchesDepartment = filterDepartment === 'all' || departmentIdForProgram(student.programId) === filterDepartment
      const matchesProgram = filterProgram === 'all' || student.programId === filterProgram
      return matchesSearch && matchesYear && matchesStatus && matchesDepartment && matchesProgram
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, programs, searchQuery, filterYear, filterStatus, filterDepartment, filterProgram])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const pageIds = paged.map((s) => s.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))
  const somePageSelected = pageIds.some((id) => selectedIds.has(id))

  function toggleSelectPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allPageSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function exportSelected(format: studentsApi.ExportFormat) {
    setIsExportingSelected(format)
    try {
      const { blob, filename } = await studentsApi.exportSelected([...selectedIds], format)
      triggerBlobDownload(blob, filename)
      showToast(`Exported ${selectedIds.size} selected student${selectedIds.size === 1 ? '' : 's'} to ${format.toUpperCase()}.`)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : `Failed to export as ${format.toUpperCase()}.`, 'error')
    } finally {
      setIsExportingSelected(null)
    }
  }

  async function confirmBulkDelete() {
    setIsBulkDeleting(true)
    const ids = [...selectedIds]
    const outcomes = await Promise.allSettled(ids.map((id) => studentsApi.remove(id)))
    const removedIds = new Set(ids.filter((_, i) => outcomes[i].status === 'fulfilled'))
    const failedCount = ids.length - removedIds.size
    setStudents((prev) => prev.filter((s) => !removedIds.has(s.id)))
    setSelectedIds(new Set())
    setBulkDeleteOpen(false)
    setIsBulkDeleting(false)
    if (failedCount === 0) {
      showToast(`Removed ${removedIds.size} student${removedIds.size === 1 ? '' : 's'}.`)
    } else {
      showToast(`Removed ${removedIds.size}, but failed to remove ${failedCount}.`, 'error')
    }
  }

  function resetFilters() {
    setSearchQuery('')
    setFilterYear('all')
    setFilterStatus('all')
    setFilterDepartment('all')
    setFilterProgram('all')
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
      setSelectedIds((prev) => {
        if (!prev.has(deletingStudent.id)) return prev
        const next = new Set(prev)
        next.delete(deletingStudent.id)
        return next
      })
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
      downloadCsv(filtered, programName, departmentName)
      showToast(`Exported ${filtered.length} students to CSV.`)
    } catch {
      showToast('Failed to export students.', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  function openImport() {
    setImportDepartment('all')
    setImportProgram('all')
    setImportFile(null)
    setImportResult(null)
    setImportModalOpen(true)
  }

  function closeImportModal() {
    setImportModalOpen(false)
    setImportFile(null)
    setImportResult(null)
  }

  async function downloadTemplate() {
    setIsDownloadingTemplate(true)
    try {
      const { blob, filename } = await studentsApi.importTemplate({
        departmentId: importDepartment === 'all' ? undefined : importDepartment,
        programId: importProgram === 'all' ? undefined : importProgram,
      })
      triggerBlobDownload(blob, filename)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to download the template.', 'error')
    } finally {
      setIsDownloadingTemplate(false)
    }
  }

  async function submitImport() {
    if (!importFile) return
    setIsImporting(true)
    setImportResult(null)
    try {
      const result = await studentsApi.importStudents(importFile)
      setImportResult(result)
      if (result.createdCount > 0) {
        await loadData()
        setPage(1)
      }
      if (result.failedCount === 0) {
        showToast(`Imported ${result.createdCount} student${result.createdCount === 1 ? '' : 's'}.`)
      }
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to import the file.', 'error')
    } finally {
      setIsImporting(false)
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
          <div className="flex gap-2">
            <button
              onClick={openImport}
              className="flex w-fit items-center gap-2 rounded-lg border border-[#e2e8f0] bg-[#ffffff] px-4 py-2.5 text-xs font-semibold text-[#475569] shadow-sm transition hover:bg-[#f1f5f9]"
            >
              <Upload size={15} /> Import students
            </button>
            <button
              onClick={openCreate}
              className="flex w-fit items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1e293b]"
            >
              <Plus size={15} /> Add student
            </button>
          </div>
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
          value={filterDepartment}
          onChange={(e) => {
            setFilterDepartment(e.target.value)
            setFilterProgram('all')
            setPage(1)
          }}
          className="rounded border border-[#e2e8f0] bg-[#ffffff] px-3 py-2 text-xs text-[#475569] outline-none"
        >
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={filterProgram}
          onChange={(e) => {
            setFilterProgram(e.target.value)
            setPage(1)
          }}
          className="rounded border border-[#e2e8f0] bg-[#ffffff] px-3 py-2 text-xs text-[#475569] outline-none"
        >
          <option value="all">All Programs</option>
          {filterProgramOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
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
        <div className="border border-[#e0e7ff] bg-[#eef2ff] p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[#475569]">
            <GraduationCap size={14} className="text-[#4f46e5]" /> Total Students
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-[#0f172a]">{students.length}</p>
        </div>
        <div className="border border-[#dcfce7] bg-[#f0fdf4] p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[#475569]">
            <UserCheck size={14} className="text-[#16a34a]" /> Active
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-[#16a34a]">
            {students.filter((s) => s.status === 'active').length}
          </p>
        </div>
        <div className="border border-[#fef3c7] bg-[#fffbeb] p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[#475569]">
            <Award size={14} className="text-[#d97706]" /> Avg. GPA
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-[#0f172a]">{avgGpa}</p>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between border border-[#e0e7ff] bg-[#eef2ff] px-4 py-2.5">
          <p className="text-xs font-semibold text-[#4f46e5]">
            {selectedIds.size} student{selectedIds.size === 1 ? '' : 's'} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportSelected('csv')}
              disabled={isExportingSelected !== null}
              className="flex items-center gap-1.5 rounded border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-60"
            >
              {isExportingSelected === 'csv' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Export CSV
            </button>
            <button
              onClick={() => exportSelected('pdf')}
              disabled={isExportingSelected !== null}
              className="flex items-center gap-1.5 rounded border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-60"
            >
              {isExportingSelected === 'pdf' ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />} Export PDF
            </button>
            {canManage && (
              <button
                onClick={() => setBulkDeleteOpen(true)}
                className="flex items-center gap-1.5 rounded border border-[#fee2e2] bg-white px-3 py-1.5 text-xs font-semibold text-[#dc2626] hover:bg-[#fee2e2]"
              >
                <Trash2 size={13} /> Delete selected
              </button>
            )}
            <button onClick={clearSelection} className="px-2 text-xs font-semibold text-[#64748b] hover:text-[#475569]">
              Clear
            </button>
          </div>
        </div>
      )}

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
                    <th className="w-10 px-5 py-3">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = !allPageSelected && somePageSelected
                        }}
                        onChange={toggleSelectPage}
                        aria-label="Select all students on this page"
                        className="h-4 w-4 accent-[#4f46e5]"
                      />
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-[#475569]">Student</th>
                    <th className="px-5 py-3 text-left font-semibold text-[#475569]">ID</th>
                    <th className="px-5 py-3 text-left font-semibold text-[#475569]">Department</th>
                    <th className="px-5 py-3 text-left font-semibold text-[#475569]">Program</th>
                    <th className="px-5 py-3 text-left font-semibold text-[#475569]">Year</th>
                    <th className="px-5 py-3 text-left font-semibold text-[#475569]">Status</th>
                    <th className="px-5 py-3 text-left font-semibold text-[#475569]">GPA</th>
                    <th className="px-5 py-3 text-center font-semibold text-[#475569]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((student) => (
                    <tr
                      key={student.id}
                      className={`border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f8fafc] ${selectedIds.has(student.id) ? 'bg-[#eef2ff]' : ''}`}
                    >
                      <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(student.id)}
                          onChange={() => toggleSelect(student.id)}
                          aria-label={`Select ${student.name}`}
                          className="h-4 w-4 accent-[#4f46e5]"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#0f172a]">{student.name}</p>
                        <p className="text-xs text-[#94a3b8]">{student.email}</p>
                      </td>
                      <td className="px-5 py-4 text-[#475569]">{student.studentId}</td>
                      <td className="px-5 py-4 text-[#475569]">{departmentName(student.programId)}</td>
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
              <dt className="text-[#64748b]">Department</dt>
              <dd className="font-semibold text-[#0f172a]">{departmentName(viewingStudent.programId)}</dd>
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

      <Modal
        open={importModalOpen}
        title="Import students"
        description="Add a whole class or department roster at once from a spreadsheet, instead of one at a time."
        onClose={closeImportModal}
        widthClassName="max-w-xl"
      >
        {importResult ? (
          <div>
            <div className="mb-4 flex items-center gap-4 border border-[#e2e8f0] bg-[#f8fafc] p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-[#16a34a]" />
                <div>
                  <p className="font-display text-lg font-bold text-[#0f172a]">{importResult.createdCount}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">Imported</p>
                </div>
              </div>
              <div className="h-8 w-px bg-[#e2e8f0]" />
              <div className="flex items-center gap-2">
                <XCircle size={18} className={importResult.failedCount > 0 ? 'text-[#dc2626]' : 'text-[#94a3b8]'} />
                <div>
                  <p className="font-display text-lg font-bold text-[#0f172a]">{importResult.failedCount}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">Skipped</p>
                </div>
              </div>
              <p className="ml-auto text-xs text-[#94a3b8]">{importResult.totalRows} row{importResult.totalRows === 1 ? '' : 's'} read</p>
            </div>

            {importResult.failedCount > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold text-[#475569]">Skipped rows — fix these and re-upload if needed</p>
                <div className="max-h-60 overflow-y-auto border border-[#e2e8f0]">
                  {importResult.results
                    .filter((r) => r.status === 'failed')
                    .map((r) => (
                      <div key={r.row} className="flex items-start gap-3 border-b border-[#e2e8f0] px-3 py-2 text-xs last:border-b-0">
                        <span className="mt-0.5 shrink-0 rounded bg-[#f1f5f9] px-1.5 py-0.5 font-mono text-[10px] text-[#64748b]">Row {r.row}</span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#0f172a]">{r.name ?? r.email ?? 'Unreadable row'}</p>
                          <p className="text-[#dc2626]">{r.error}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={openImport}
                className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9]"
              >
                Import another file
              </button>
              <button
                onClick={closeImportModal}
                className="rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#1e293b]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-5 border border-[#e2e8f0] p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#475569]">Step 1 — Get the template</p>
              <p className="mb-3 text-xs text-[#64748b]">
                Optionally narrow it to one department or program — the file will list only matching program codes as a
                reference, so there's less guessing when you fill it in.
              </p>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <select
                  value={importDepartment}
                  onChange={(e) => {
                    setImportDepartment(e.target.value)
                    setImportProgram('all')
                  }}
                  className={inputClassName}
                >
                  <option value="all">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <select value={importProgram} onChange={(e) => setImportProgram(e.target.value)} className={inputClassName}>
                  <option value="all">All programs</option>
                  {importProgramOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={downloadTemplate}
                disabled={isDownloadingTemplate}
                className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-60"
              >
                {isDownloadingTemplate ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                {isDownloadingTemplate ? 'Preparing template...' : 'Download .xlsx template'}
              </button>
            </div>

            <div className="mb-5 border border-[#e2e8f0] p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#475569]">Step 2 — Upload the completed file</p>
              <label className="flex cursor-pointer items-center gap-3 border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-4 text-xs text-[#64748b] hover:bg-[#f1f5f9]">
                <Upload size={16} className="shrink-0 text-[#475569]" />
                <span className="min-w-0 flex-1 truncate">
                  {importFile ? <span className="font-semibold text-[#0f172a]">{importFile.name}</span> : 'Choose a .xlsx or .csv file...'}
                </span>
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <p className="mt-2 text-[10px] text-[#94a3b8]">
                Each row is validated independently — rows with a problem (bad email, unknown program code, a duplicate ID)
                are skipped and listed after upload; everything else is still imported.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={closeImportModal} className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9]">
                Cancel
              </button>
              <button
                onClick={submitImport}
                disabled={!importFile || isImporting}
                className="flex items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isImporting && <Loader2 size={14} className="animate-spin" />}
                {isImporting ? 'Importing...' : 'Upload & import'}
              </button>
            </div>
          </div>
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

      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Remove selected students"
        description={`This will permanently remove ${selectedIds.size} student${selectedIds.size === 1 ? '' : 's'} from the roster. This cannot be undone.`}
        confirmLabel={isBulkDeleting ? 'Removing...' : 'Remove students'}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </div>
  )
}
