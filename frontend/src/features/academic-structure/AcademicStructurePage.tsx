import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Building2,
  GraduationCap,
  Calendar,
  BookOpen,
  Users,
  Network,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import FormField, { inputClassName, inputErrorClassName } from '@/components/ui/FormField'
import * as departmentsApi from '@/api/departments'
import * as programsApi from '@/api/programs'
import * as semestersApi from '@/api/semesters'
import * as subjectsApi from '@/api/subjects'
import * as studentsApi from '@/api/students'
import * as academicStructureApi from '@/api/academic-structure'
import { ApiRequestError } from '@/api/client'
import { triggerBlobDownload } from '@/utils/download'
import type { ImportSummary } from '@/api/academic-structure'
import type { Department, Program, Semester, Student, Subject } from '@/types'

const tabs = [
  { id: 'departments', label: 'Departments' },
  { id: 'programs', label: 'Programs' },
  { id: 'semesters', label: 'Semesters' },
  { id: 'subjects', label: 'Subjects' },
  { id: 'hierarchy', label: 'Hierarchy Map' },
] as const

type TabId = (typeof tabs)[number]['id']

const departmentSchema = z.object({ name: z.string().min(2, 'Name is required.'), code: z.string().min(2, 'Code is required.').toUpperCase() })
const programSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  code: z.string().min(2, 'Code is required.').toUpperCase(),
  departmentId: z.string().min(1, 'Select a department.'),
  years: z.coerce.number().min(1).max(6),
})
const semesterSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  programId: z.string().min(1, 'Select a program.'),
  year: z.coerce.number().min(1).max(6),
  startDate: z.string().min(1, 'Start date is required.'),
  endDate: z.string().min(1, 'End date is required.'),
})
const subjectSchema = z.object({
  code: z.string().min(2, 'Code is required.').toUpperCase(),
  name: z.string().min(2, 'Name is required.'),
  credits: z.coerce.number().min(1).max(10),
  semesterId: z.string().min(1, 'Select a semester.'),
})

export default function AcademicStructurePage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const canManage = user?.role === 'super_admin' || user?.role === 'registrar'
  const [activeTab, setActiveTab] = useState<TabId>('departments')
  const [searchQuery, setSearchQuery] = useState('')

  const [departments, setDepartments] = useState<Department[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [deptModalOpen, setDeptModalOpen] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [deletingDept, setDeletingDept] = useState<Department | null>(null)
  const deptForm = useForm<z.infer<typeof departmentSchema>>({ resolver: zodResolver(departmentSchema) })

  const [progModalOpen, setProgModalOpen] = useState(false)
  const [editingProg, setEditingProg] = useState<Program | null>(null)
  const [deletingProg, setDeletingProg] = useState<Program | null>(null)
  const progForm = useForm<z.infer<typeof programSchema>>({ resolver: zodResolver(programSchema) })

  const [semModalOpen, setSemModalOpen] = useState(false)
  const [editingSem, setEditingSem] = useState<Semester | null>(null)
  const [deletingSem, setDeletingSem] = useState<Semester | null>(null)
  const semForm = useForm<z.infer<typeof semesterSchema>>({ resolver: zodResolver(semesterSchema) })

  const [subjModalOpen, setSubjModalOpen] = useState(false)
  const [editingSubj, setEditingSubj] = useState<Subject | null>(null)
  const [deletingSubj, setDeletingSubj] = useState<Subject | null>(null)
  const subjForm = useForm<z.infer<typeof subjectSchema>>({ resolver: zodResolver(subjectSchema) })

  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportSummary | null>(null)

  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [expandedProgs, setExpandedProgs] = useState<Set<string>>(new Set())
  const [expandedSems, setExpandedSems] = useState<Set<string>>(new Set())

  async function loadData() {
    setLoading(true)
    setLoadError('')
    try {
      const [departmentRows, programRows, semesterRows, subjectRows, studentRows] = await Promise.all([
        departmentsApi.list(),
        programsApi.list(),
        semestersApi.list(),
        subjectsApi.list(),
        studentsApi.list(),
      ])
      setDepartments(departmentRows)
      setPrograms(programRows)
      setSemesters(semesterRows)
      setSubjects(subjectRows)
      setStudents(studentRows)
    } catch (err) {
      setLoadError(err instanceof ApiRequestError ? err.message : 'Failed to load the academic structure.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const q = searchQuery.trim().toLowerCase()
  const filteredDepartments = useMemo(
    () => departments.filter((d) => !q || d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)),
    [departments, q],
  )
  const filteredPrograms = useMemo(
    () => programs.filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)),
    [programs, q],
  )
  const filteredSemesters = useMemo(() => semesters.filter((s) => !q || s.name.toLowerCase().includes(q)), [semesters, q])
  const filteredSubjects = useMemo(
    () => subjects.filter((s) => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)),
    [subjects, q],
  )

  function departmentName(id: string) {
    return departments.find((d) => d.id === id)?.name ?? 'Unknown'
  }
  function programName(id: string) {
    return programs.find((p) => p.id === id)?.name ?? 'Unknown'
  }
  function studentCountFor(departmentId: string) {
    const programIds = new Set(programs.filter((p) => p.departmentId === departmentId).map((p) => p.id))
    return students.filter((s) => programIds.has(s.programId)).length
  }

  function openAdd() {
    if (activeTab === 'departments') {
      setEditingDept(null)
      deptForm.reset({ name: '', code: '' })
      setDeptModalOpen(true)
    } else if (activeTab === 'programs') {
      setEditingProg(null)
      progForm.reset({ name: '', code: '', departmentId: departments[0]?.id ?? '', years: 4 })
      setProgModalOpen(true)
    } else if (activeTab === 'semesters') {
      setEditingSem(null)
      semForm.reset({ name: '', programId: programs[0]?.id ?? '', year: 1, startDate: '', endDate: '' })
      setSemModalOpen(true)
    } else if (activeTab === 'subjects') {
      setEditingSubj(null)
      subjForm.reset({ code: '', name: '', credits: 4, semesterId: semesters[0]?.id ?? '' })
      setSubjModalOpen(true)
    }
  }

  async function onSubmitDept(values: z.infer<typeof departmentSchema>) {
    try {
      if (editingDept) {
        const updated = await departmentsApi.update(editingDept.id, values)
        setDepartments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
        showToast(`${updated.name} updated.`)
      } else {
        const created = await departmentsApi.create(values)
        setDepartments((prev) => [created, ...prev])
        showToast(`${created.name} added.`)
      }
      setDeptModalOpen(false)
    } catch (err) {
      if (err instanceof ApiRequestError && err.fieldErrors) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (field === 'name' || field === 'code') deptForm.setError(field, { message })
        }
      } else {
        showToast(err instanceof ApiRequestError ? err.message : 'Something went wrong.', 'error')
      }
    }
  }

  async function onSubmitProg(values: z.infer<typeof programSchema>) {
    try {
      if (editingProg) {
        const updated = await programsApi.update(editingProg.id, values)
        setPrograms((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        showToast(`${updated.name} updated.`)
      } else {
        const created = await programsApi.create(values)
        setPrograms((prev) => [created, ...prev])
        showToast(`${created.name} added.`)
      }
      setProgModalOpen(false)
    } catch (err) {
      if (err instanceof ApiRequestError && err.fieldErrors) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (field === 'name' || field === 'code' || field === 'departmentId' || field === 'years') progForm.setError(field, { message })
        }
      } else {
        showToast(err instanceof ApiRequestError ? err.message : 'Something went wrong.', 'error')
      }
    }
  }

  async function onSubmitSem(values: z.infer<typeof semesterSchema>) {
    try {
      if (editingSem) {
        const updated = await semestersApi.update(editingSem.id, values)
        setSemesters((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        showToast(`${updated.name} updated.`)
      } else {
        const created = await semestersApi.create(values)
        setSemesters((prev) => [created, ...prev])
        showToast(`${created.name} added.`)
      }
      setSemModalOpen(false)
    } catch (err) {
      if (err instanceof ApiRequestError && err.fieldErrors) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (field === 'name' || field === 'programId' || field === 'year' || field === 'startDate' || field === 'endDate') {
            semForm.setError(field, { message })
          }
        }
      } else {
        showToast(err instanceof ApiRequestError ? err.message : 'Something went wrong.', 'error')
      }
    }
  }

  async function onSubmitSubj(values: z.infer<typeof subjectSchema>) {
    try {
      if (editingSubj) {
        const updated = await subjectsApi.update(editingSubj.id, values)
        setSubjects((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        showToast(`${updated.name} updated.`)
      } else {
        const created = await subjectsApi.create(values)
        setSubjects((prev) => [created, ...prev])
        showToast(`${created.name} added.`)
      }
      setSubjModalOpen(false)
    } catch (err) {
      if (err instanceof ApiRequestError && err.fieldErrors) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (field === 'code' || field === 'name' || field === 'credits' || field === 'semesterId') subjForm.setError(field, { message })
        }
      } else {
        showToast(err instanceof ApiRequestError ? err.message : 'Something went wrong.', 'error')
      }
    }
  }

  async function confirmDeleteDept() {
    if (!deletingDept) return
    try {
      await departmentsApi.remove(deletingDept.id)
      setDepartments((prev) => prev.filter((d) => d.id !== deletingDept.id))
      showToast(`${deletingDept.name} deleted.`)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to delete department.', 'error')
    } finally {
      setDeletingDept(null)
    }
  }

  async function confirmDeleteProg() {
    if (!deletingProg) return
    try {
      await programsApi.remove(deletingProg.id)
      setPrograms((prev) => prev.filter((p) => p.id !== deletingProg.id))
      showToast(`${deletingProg.name} deleted.`)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to delete program.', 'error')
    } finally {
      setDeletingProg(null)
    }
  }

  async function confirmDeleteSem() {
    if (!deletingSem) return
    try {
      await semestersApi.remove(deletingSem.id)
      setSemesters((prev) => prev.filter((s) => s.id !== deletingSem.id))
      showToast(`${deletingSem.name} deleted.`)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to delete semester.', 'error')
    } finally {
      setDeletingSem(null)
    }
  }

  async function confirmDeleteSubj() {
    if (!deletingSubj) return
    try {
      await subjectsApi.remove(deletingSubj.id)
      setSubjects((prev) => prev.filter((s) => s.id !== deletingSubj.id))
      showToast(`${deletingSubj.name} deleted.`)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to delete subject.', 'error')
    } finally {
      setDeletingSubj(null)
    }
  }

  function openImport() {
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
      const { blob, filename } = await academicStructureApi.importTemplate()
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
      const result = await academicStructureApi.importHierarchy(importFile)
      setImportResult(result)
      if (result.successCount > 0) await loadData()
      if (result.failedCount === 0) {
        showToast(`Imported ${result.successCount} row${result.successCount === 1 ? '' : 's'} successfully.`)
      }
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to import the file.', 'error')
    } finally {
      setIsImporting(false)
    }
  }

  function toggleDept(id: string) {
    setExpandedDepts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleProg(id: string) {
    setExpandedProgs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleSem(id: string) {
    setExpandedSems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Interactive tree: a node "passes" the search filter if it matches
  // directly, or has at least one passing descendant. Passing branches are
  // force-expanded while a search is active so a match is never hidden
  // behind a collapsed node.
  const hierarchy = useMemo(() => {
    return departments
      .map((dept) => {
        const deptPrograms = programs.filter((p) => p.departmentId === dept.id).map((prog) => {
          const progSemesters = semesters.filter((s) => s.programId === prog.id).map((sem) => {
            const semSubjects = subjects.filter((subj) => subj.semesterId === sem.id).map((subj) => ({
              subject: subj,
              matches: !q || subj.name.toLowerCase().includes(q) || subj.code.toLowerCase().includes(q),
            }))
            const semMatches = !q || sem.name.toLowerCase().includes(q)
            return { semester: sem, subjects: semSubjects, passes: semMatches || semSubjects.some((s) => s.matches) }
          })
          const progMatches = !q || prog.name.toLowerCase().includes(q) || prog.code.toLowerCase().includes(q)
          return { program: prog, semesters: progSemesters, passes: progMatches || progSemesters.some((s) => s.passes) }
        })
        const deptMatches = !q || dept.name.toLowerCase().includes(q) || dept.code.toLowerCase().includes(q)
        return { department: dept, programs: deptPrograms, passes: deptMatches || deptPrograms.some((p) => p.passes) }
      })
      .filter((d) => d.passes)
  }, [departments, programs, semesters, subjects, q])

  const searching = q.length > 0

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-8 sm:px-9 lg:px-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#4f46e5]">Organization</p>
          <h1 className="font-display text-[32px] font-bold tracking-[-0.04em] text-[#0f172a]">Academic Structure</h1>
          <p className="mt-2 text-sm text-[#64748b]">Manage departments, programs, semesters, and subjects.</p>
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <button
              onClick={openImport}
              className="flex w-fit items-center gap-2 rounded-lg border border-[#e2e8f0] bg-[#ffffff] px-4 py-2.5 text-xs font-semibold text-[#475569] shadow-sm transition hover:bg-[#f1f5f9]"
            >
              <Upload size={15} /> Bulk import
            </button>
            {activeTab !== 'hierarchy' && (
              <button
                onClick={openAdd}
                className="flex w-fit items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1e293b]"
              >
                <Plus size={15} /> Add {activeTab.slice(0, -1)}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-600 shadow-sm">
            <Building2 size={14} className="text-indigo-600" />
            <span>Catalog View-Only (Managed by University Registrar)</span>
          </div>
        )}
      </div>

      <div className="mb-6 flex gap-1 border-b border-[#e2e8f0]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setSearchQuery('')
            }}
            className={`px-4 py-3 text-sm font-semibold transition ${
              activeTab === tab.id ? 'border-b-2 border-[#0f172a] text-[#0f172a]' : 'text-[#64748b] hover:text-[#475569]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 border-b border-[#cbd5e1] px-3 py-2 text-[#64748b]">
          <Search size={16} />
          <input
            type="text"
            placeholder={activeTab === 'hierarchy' ? 'Search the hierarchy...' : `Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#0f172a] placeholder-[#94a3b8] outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="animate-spin text-[#475569]" size={28} />
        </div>
      ) : loadError ? (
        <EmptyState icon={AlertCircle} title="Couldn't load the academic structure" description={loadError} action={{ label: 'Retry', onClick: loadData }} />
      ) : (
        <>
          {activeTab === 'departments' &&
            (filteredDepartments.length === 0 ? (
              <EmptyState icon={Search} title="No departments found" description="Try a different search term or add a new department." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredDepartments.map((dept) => {
                  const programCount = programs.filter((p) => p.departmentId === dept.id).length
                  return (
                    <div key={dept.id} className="border border-[#e2e8f0] bg-[#ffffff] p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-[#0f172a]">{dept.name}</h3>
                          <p className="text-xs text-[#94a3b8]">Code: {dept.code}</p>
                        </div>
                        {canManage && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingDept(dept)
                                deptForm.reset({ name: dept.name, code: dept.code })
                                setDeptModalOpen(true)
                              }}
                              className="rounded p-1 text-[#475569] hover:bg-[#e2e8f0]"
                              aria-label={`Edit ${dept.name}`}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => setDeletingDept(dept)}
                              className="rounded p-1 text-[#dc2626] hover:bg-[#fee2e2]"
                              aria-label={`Delete ${dept.name}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-[#64748b]">Programs</p>
                          <p className="font-display text-xl font-bold text-[#0f172a]">{programCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#64748b]">Students</p>
                          <p className="font-display text-xl font-bold text-[#0f172a]">{studentCountFor(dept.id)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}

          {activeTab === 'programs' &&
            (filteredPrograms.length === 0 ? (
              <EmptyState icon={Search} title="No programs found" description="Try a different search term or add a new program." />
            ) : (
              <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#ffffff]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e2e8f0] bg-[#f1f5f9]">
                        <th className="px-5 py-3 text-left font-semibold text-[#475569]">Program</th>
                        <th className="px-5 py-3 text-left font-semibold text-[#475569]">Code</th>
                        <th className="px-5 py-3 text-left font-semibold text-[#475569]">Department</th>
                        <th className="px-5 py-3 text-left font-semibold text-[#475569]">Years</th>
                        {canManage && <th className="px-5 py-3 text-center font-semibold text-[#475569]">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPrograms.map((prog) => (
                        <tr key={prog.id} className="border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f8fafc]">
                          <td className="px-5 py-4 font-semibold text-[#0f172a]">{prog.name}</td>
                          <td className="px-5 py-4 text-[#475569]">{prog.code}</td>
                          <td className="px-5 py-4 text-[#475569]">{departmentName(prog.departmentId)}</td>
                          <td className="px-5 py-4 text-[#475569]">{prog.years}</td>
                          {canManage && (
                            <td className="px-5 py-4">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditingProg(prog)
                                    progForm.reset(prog)
                                    setProgModalOpen(true)
                                  }}
                                  className="rounded p-1 text-[#475569] hover:bg-[#e2e8f0]"
                                  aria-label={`Edit ${prog.name}`}
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => setDeletingProg(prog)}
                                  className="rounded p-1 text-[#dc2626] hover:bg-[#fee2e2]"
                                  aria-label={`Delete ${prog.name}`}
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
            ))}

          {activeTab === 'semesters' &&
            (filteredSemesters.length === 0 ? (
              <EmptyState icon={Search} title="No semesters found" description="Try a different search term or add a new semester." />
            ) : (
              <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#ffffff]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e2e8f0] bg-[#f1f5f9]">
                        <th className="px-5 py-3 text-left font-semibold text-[#475569]">Semester</th>
                        <th className="px-5 py-3 text-left font-semibold text-[#475569]">Program</th>
                        <th className="px-5 py-3 text-left font-semibold text-[#475569]">Year</th>
                        <th className="px-5 py-3 text-left font-semibold text-[#475569]">Start Date</th>
                        <th className="px-5 py-3 text-left font-semibold text-[#475569]">End Date</th>
                        {canManage && <th className="px-5 py-3 text-center font-semibold text-[#475569]">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSemesters.map((sem) => (
                        <tr key={sem.id} className="border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f8fafc]">
                          <td className="px-5 py-4 font-semibold text-[#0f172a]">{sem.name}</td>
                          <td className="px-5 py-4 text-[#475569]">{programName(sem.programId)}</td>
                          <td className="px-5 py-4 text-[#475569]">{sem.year}</td>
                          <td className="px-5 py-4 text-[#475569]">{sem.startDate}</td>
                          <td className="px-5 py-4 text-[#475569]">{sem.endDate}</td>
                          {canManage && (
                            <td className="px-5 py-4">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditingSem(sem)
                                    semForm.reset(sem)
                                    setSemModalOpen(true)
                                  }}
                                  className="rounded p-1 text-[#475569] hover:bg-[#e2e8f0]"
                                  aria-label={`Edit ${sem.name}`}
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => setDeletingSem(sem)}
                                  className="rounded p-1 text-[#dc2626] hover:bg-[#fee2e2]"
                                  aria-label={`Delete ${sem.name}`}
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
            ))}

          {activeTab === 'subjects' &&
            (filteredSubjects.length === 0 ? (
              <EmptyState icon={Search} title="No subjects found" description="Try a different search term or add a new subject." />
            ) : (
              <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#ffffff]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e2e8f0] bg-[#f1f5f9]">
                        <th className="px-5 py-3 text-left font-semibold text-[#475569]">Subject</th>
                        <th className="px-5 py-3 text-left font-semibold text-[#475569]">Code</th>
                        <th className="px-5 py-3 text-left font-semibold text-[#475569]">Credits</th>
                        <th className="px-5 py-3 text-left font-semibold text-[#475569]">Semester</th>
                        {canManage && <th className="px-5 py-3 text-center font-semibold text-[#475569]">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubjects.map((subject) => (
                        <tr key={subject.id} className="border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f8fafc]">
                          <td className="px-5 py-4 font-semibold text-[#0f172a]">{subject.name}</td>
                          <td className="px-5 py-4 text-[#475569]">{subject.code}</td>
                          <td className="px-5 py-4 text-[#475569]">{subject.credits}</td>
                          <td className="px-5 py-4 text-[#475569]">{semesters.find((s) => s.id === subject.semesterId)?.name ?? 'Unknown'}</td>
                          {canManage && (
                            <td className="px-5 py-4">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditingSubj(subject)
                                    subjForm.reset(subject)
                                    setSubjModalOpen(true)
                                  }}
                                  className="rounded p-1 text-[#475569] hover:bg-[#e2e8f0]"
                                  aria-label={`Edit ${subject.name}`}
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => setDeletingSubj(subject)}
                                  className="rounded p-1 text-[#dc2626] hover:bg-[#fee2e2]"
                                  aria-label={`Delete ${subject.name}`}
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
            ))}

          {activeTab === 'hierarchy' &&
            (hierarchy.length === 0 ? (
              <EmptyState icon={Network} title="No structure to map yet" description="Add a department to start building the hierarchy, or try a different search term." />
            ) : (
              <div className="rounded-lg border border-[#e2e8f0] bg-[#ffffff] p-5">
                <p className="mb-4 flex items-center gap-2 text-xs text-[#64748b]">
                  <Network size={14} /> Department → Program → Semester → Subject. Click a row to expand it.
                </p>
                <div className="space-y-1">
                  {hierarchy.map(({ department, programs: deptPrograms }) => {
                    const deptOpen = searching || expandedDepts.has(department.id)
                    return (
                      <div key={department.id} className="border-l-2 border-[#e2e8f0] pl-0">
                        <button
                          onClick={() => toggleDept(department.id)}
                          className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-[#f8fafc]"
                        >
                          {deptOpen ? <ChevronDown size={15} className="shrink-0 text-[#94a3b8]" /> : <ChevronRight size={15} className="shrink-0 text-[#94a3b8]" />}
                          <Building2 size={16} className="shrink-0 text-[#4f46e5]" />
                          <span className="font-semibold text-[#0f172a]">{department.name}</span>
                          <span className="text-xs text-[#94a3b8]">({department.code})</span>
                          <span className="ml-auto flex items-center gap-1 text-xs text-[#64748b]">
                            <Users size={12} /> {studentCountFor(department.id)}
                          </span>
                        </button>
                        {deptOpen && (
                          <div className="ml-5 space-y-1 border-l-2 border-[#eef2ff] pl-3">
                            {deptPrograms.length === 0 ? (
                              <p className="px-2 py-1.5 text-xs text-[#94a3b8]">No programs under this department yet.</p>
                            ) : (
                              deptPrograms.map(({ program, semesters: progSemesters }) => {
                                const progOpen = searching || expandedProgs.has(program.id)
                                return (
                                  <div key={program.id}>
                                    <button
                                      onClick={() => toggleProg(program.id)}
                                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-[#f8fafc]"
                                    >
                                      {progOpen ? <ChevronDown size={14} className="shrink-0 text-[#94a3b8]" /> : <ChevronRight size={14} className="shrink-0 text-[#94a3b8]" />}
                                      <GraduationCap size={15} className="shrink-0 text-[#16a34a]" />
                                      <span className="text-sm font-semibold text-[#0f172a]">{program.name}</span>
                                      <span className="text-xs text-[#94a3b8]">({program.code}, {program.years}y)</span>
                                    </button>
                                    {progOpen && (
                                      <div className="ml-5 space-y-1 border-l-2 border-[#f0fdf4] pl-3">
                                        {progSemesters.length === 0 ? (
                                          <p className="px-2 py-1.5 text-xs text-[#94a3b8]">No semesters under this program yet.</p>
                                        ) : (
                                          progSemesters.map(({ semester, subjects: semSubjects }) => {
                                            const semOpen = searching || expandedSems.has(semester.id)
                                            return (
                                              <div key={semester.id}>
                                                <button
                                                  onClick={() => toggleSem(semester.id)}
                                                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-[#f8fafc]"
                                                >
                                                  {semOpen ? <ChevronDown size={13} className="shrink-0 text-[#94a3b8]" /> : <ChevronRight size={13} className="shrink-0 text-[#94a3b8]" />}
                                                  <Calendar size={14} className="shrink-0 text-[#d97706]" />
                                                  <span className="text-sm font-medium text-[#0f172a]">{semester.name}</span>
                                                  <span className="text-xs text-[#94a3b8]">
                                                    {semester.startDate} – {semester.endDate}
                                                  </span>
                                                </button>
                                                {semOpen && (
                                                  <div className="ml-5 space-y-1 border-l-2 border-[#fffbeb] pl-3">
                                                    {semSubjects.length === 0 ? (
                                                      <p className="px-2 py-1.5 text-xs text-[#94a3b8]">No subjects under this semester yet.</p>
                                                    ) : (
                                                      semSubjects.map(({ subject }) => (
                                                        <div key={subject.id} className="flex items-center gap-2 rounded px-2 py-1.5">
                                                          <BookOpen size={13} className="shrink-0 text-[#0f172a]" />
                                                          <span className="text-sm text-[#0f172a]">{subject.name}</span>
                                                          <span className="text-xs text-[#94a3b8]">
                                                            ({subject.code}, {subject.credits} credits)
                                                          </span>
                                                        </div>
                                                      ))
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            )
                                          })
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
        </>
      )}

      {/* Department modal */}
      <Modal open={deptModalOpen} title={editingDept ? 'Edit department' : 'Add department'} onClose={() => setDeptModalOpen(false)}>
        <form onSubmit={deptForm.handleSubmit(onSubmitDept)} noValidate>
          <FormField label="Department name" htmlFor="dept-name" error={deptForm.formState.errors.name?.message} required>
            <input id="dept-name" className={deptForm.formState.errors.name ? inputErrorClassName : inputClassName} {...deptForm.register('name')} />
          </FormField>
          <FormField label="Code" htmlFor="dept-code" error={deptForm.formState.errors.code?.message} required>
            <input id="dept-code" className={deptForm.formState.errors.code ? inputErrorClassName : inputClassName} {...deptForm.register('code')} />
          </FormField>
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={() => setDeptModalOpen(false)} className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={deptForm.formState.isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-70"
            >
              {deptForm.formState.isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {editingDept ? 'Save changes' : 'Add department'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Program modal */}
      <Modal open={progModalOpen} title={editingProg ? 'Edit program' : 'Add program'} onClose={() => setProgModalOpen(false)}>
        <form onSubmit={progForm.handleSubmit(onSubmitProg)} noValidate>
          <FormField label="Program name" htmlFor="prog-name" error={progForm.formState.errors.name?.message} required>
            <input id="prog-name" className={progForm.formState.errors.name ? inputErrorClassName : inputClassName} {...progForm.register('name')} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Code" htmlFor="prog-code" error={progForm.formState.errors.code?.message} required>
              <input id="prog-code" className={progForm.formState.errors.code ? inputErrorClassName : inputClassName} {...progForm.register('code')} />
            </FormField>
            <FormField label="Duration (years)" htmlFor="prog-years" error={progForm.formState.errors.years?.message} required>
              <input id="prog-years" type="number" min={1} max={6} className={inputClassName} {...progForm.register('years')} />
            </FormField>
          </div>
          <FormField label="Department" htmlFor="prog-dept" error={progForm.formState.errors.departmentId?.message} required>
            <select id="prog-dept" className={inputClassName} {...progForm.register('departmentId')}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </FormField>
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={() => setProgModalOpen(false)} className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={progForm.formState.isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-70"
            >
              {progForm.formState.isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {editingProg ? 'Save changes' : 'Add program'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Semester modal */}
      <Modal open={semModalOpen} title={editingSem ? 'Edit semester' : 'Add semester'} onClose={() => setSemModalOpen(false)}>
        <form onSubmit={semForm.handleSubmit(onSubmitSem)} noValidate>
          <FormField label="Semester name" htmlFor="sem-name" error={semForm.formState.errors.name?.message} required>
            <input id="sem-name" className={inputClassName} {...semForm.register('name')} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Program" htmlFor="sem-program" error={semForm.formState.errors.programId?.message} required>
              <select id="sem-program" className={inputClassName} {...semForm.register('programId')}>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Year" htmlFor="sem-year" error={semForm.formState.errors.year?.message} required>
              <input id="sem-year" type="number" min={1} max={6} className={inputClassName} {...semForm.register('year')} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start date" htmlFor="sem-start" error={semForm.formState.errors.startDate?.message} required>
              <input id="sem-start" type="date" className={semForm.formState.errors.startDate ? inputErrorClassName : inputClassName} {...semForm.register('startDate')} />
            </FormField>
            <FormField label="End date" htmlFor="sem-end" error={semForm.formState.errors.endDate?.message} required>
              <input id="sem-end" type="date" className={semForm.formState.errors.endDate ? inputErrorClassName : inputClassName} {...semForm.register('endDate')} />
            </FormField>
          </div>
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={() => setSemModalOpen(false)} className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={semForm.formState.isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-70"
            >
              {semForm.formState.isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {editingSem ? 'Save changes' : 'Add semester'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Subject modal */}
      <Modal open={subjModalOpen} title={editingSubj ? 'Edit subject' : 'Add subject'} onClose={() => setSubjModalOpen(false)}>
        <form onSubmit={subjForm.handleSubmit(onSubmitSubj)} noValidate>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Code" htmlFor="subj-code" error={subjForm.formState.errors.code?.message} required>
              <input id="subj-code" className={inputClassName} {...subjForm.register('code')} />
            </FormField>
            <FormField label="Credits" htmlFor="subj-credits" error={subjForm.formState.errors.credits?.message} required>
              <input id="subj-credits" type="number" min={1} max={10} className={inputClassName} {...subjForm.register('credits')} />
            </FormField>
          </div>
          <FormField label="Subject name" htmlFor="subj-name" error={subjForm.formState.errors.name?.message} required>
            <input id="subj-name" className={inputClassName} {...subjForm.register('name')} />
          </FormField>
          <FormField label="Semester" htmlFor="subj-semester" error={subjForm.formState.errors.semesterId?.message} required>
            <select id="subj-semester" className={inputClassName} {...subjForm.register('semesterId')}>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({programName(s.programId)})
                </option>
              ))}
            </select>
          </FormField>
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={() => setSubjModalOpen(false)} className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={subjForm.formState.isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-70"
            >
              {subjForm.formState.isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {editingSubj ? 'Save changes' : 'Add subject'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk import modal */}
      <Modal
        open={importModalOpen}
        title="Bulk import academic structure"
        description="Create departments, programs, semesters, and subjects at once from a spreadsheet."
        onClose={closeImportModal}
        widthClassName="max-w-xl"
      >
        {importResult ? (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-4 border border-[#e2e8f0] bg-[#f8fafc] p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-[#16a34a]" />
                <div>
                  <p className="font-display text-lg font-bold text-[#0f172a]">{importResult.successCount}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">Rows processed</p>
                </div>
              </div>
              <div className="h-8 w-px bg-[#e2e8f0]" />
              <div className="flex items-center gap-2">
                <XCircle size={18} className={importResult.failedCount > 0 ? 'text-[#dc2626]' : 'text-[#94a3b8]'} />
                <div>
                  <p className="font-display text-lg font-bold text-[#0f172a]">{importResult.failedCount}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">Failed</p>
                </div>
              </div>
              <p className="ml-auto text-xs text-[#94a3b8]">{importResult.totalRows} row{importResult.totalRows === 1 ? '' : 's'} read</p>
            </div>

            <div className="mb-4 grid grid-cols-4 gap-2 text-center">
              <div className="rounded border border-[#e2e8f0] bg-[#ffffff] py-2">
                <p className="font-display text-base font-bold text-[#0f172a]">{importResult.departmentsCreated}</p>
                <p className="text-[10px] text-[#64748b]">Departments</p>
              </div>
              <div className="rounded border border-[#e2e8f0] bg-[#ffffff] py-2">
                <p className="font-display text-base font-bold text-[#0f172a]">{importResult.programsCreated}</p>
                <p className="text-[10px] text-[#64748b]">Programs</p>
              </div>
              <div className="rounded border border-[#e2e8f0] bg-[#ffffff] py-2">
                <p className="font-display text-base font-bold text-[#0f172a]">{importResult.semestersCreated}</p>
                <p className="text-[10px] text-[#64748b]">Semesters</p>
              </div>
              <div className="rounded border border-[#e2e8f0] bg-[#ffffff] py-2">
                <p className="font-display text-base font-bold text-[#0f172a]">{importResult.subjectsCreated}</p>
                <p className="text-[10px] text-[#64748b]">Subjects</p>
              </div>
            </div>

            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold text-[#475569]">Row results</p>
              <div className="max-h-60 overflow-y-auto border border-[#e2e8f0]">
                {importResult.results.map((r) => (
                  <div key={r.row} className="flex items-start gap-3 border-b border-[#e2e8f0] px-3 py-2 text-xs last:border-b-0">
                    {r.status === 'success' ? (
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#16a34a]" />
                    ) : (
                      <XCircle size={14} className="mt-0.5 shrink-0 text-[#dc2626]" />
                    )}
                    <span className="mt-0.5 shrink-0 rounded bg-[#f1f5f9] px-1.5 py-0.5 font-mono text-[10px] text-[#64748b]">Row {r.row}</span>
                    <div className="min-w-0">
                      {r.status === 'success' ? (
                        <p className="text-[#475569]">{r.summary}</p>
                      ) : (
                        <p className="text-[#dc2626]">{r.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
                Each row can describe as much or as little of the hierarchy as you want — a department alone, or all the
                way down to a subject. Repeating a department or program code across rows reuses it instead of erroring.
              </p>
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
                <input type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
              </label>
              <p className="mt-2 text-[10px] text-[#94a3b8]">
                Each row is validated independently — a row with a problem (bad dates, an unknown reference) is skipped
                and listed after upload; everything else is still imported.
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
        open={!!deletingDept}
        title="Delete department"
        description={`Delete ${deletingDept?.name ?? ''}? Programs under this department will not be reassigned automatically.`}
        confirmLabel="Delete"
        onConfirm={confirmDeleteDept}
        onCancel={() => setDeletingDept(null)}
      />
      <ConfirmDialog
        open={!!deletingProg}
        title="Delete program"
        description={`Delete ${deletingProg?.name ?? ''}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDeleteProg}
        onCancel={() => setDeletingProg(null)}
      />
      <ConfirmDialog
        open={!!deletingSem}
        title="Delete semester"
        description={`Delete ${deletingSem?.name ?? ''}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDeleteSem}
        onCancel={() => setDeletingSem(null)}
      />
      <ConfirmDialog
        open={!!deletingSubj}
        title="Delete subject"
        description={`Delete ${deletingSubj?.name ?? ''}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDeleteSubj}
        onCancel={() => setDeletingSubj(null)}
      />
    </div>
  )
}
