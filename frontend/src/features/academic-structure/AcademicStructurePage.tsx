import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import FormField, { inputClassName, inputErrorClassName } from '@/components/ui/FormField'
import {
  departments as initialDepartments,
  programs as initialPrograms,
  semesters as initialSemesters,
  subjects as initialSubjects,
  students,
  nextId,
} from '@/services/mockData'
import type { Department, Program, Semester, Subject } from '@/types'

const tabs = [
  { id: 'departments', label: 'Departments' },
  { id: 'programs', label: 'Programs' },
  { id: 'semesters', label: 'Semesters' },
  { id: 'subjects', label: 'Subjects' },
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
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<TabId>('departments')
  const [searchQuery, setSearchQuery] = useState('')

  const [departments, setDepartments] = useState<Department[]>(initialDepartments)
  const [programs, setPrograms] = useState<Program[]>(initialPrograms)
  const [semesters, setSemesters] = useState<Semester[]>(initialSemesters)
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects)

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
    } else {
      setEditingSubj(null)
      subjForm.reset({ code: '', name: '', credits: 4, semesterId: semesters[0]?.id ?? '' })
      setSubjModalOpen(true)
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-8 sm:px-9 lg:px-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#4f46e5]">Organization</p>
          <h1 className="font-display text-[32px] font-bold tracking-[-0.04em] text-[#0f172a]">Academic Structure</h1>
          <p className="mt-2 text-sm text-[#64748b]">Manage departments, programs, semesters, and subjects.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex w-fit items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1e293b]"
        >
          <Plus size={15} /> Add {activeTab.slice(0, -1)}
        </button>
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
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#0f172a] placeholder-[#94a3b8] outline-none"
          />
        </div>
      </div>

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
                    <th className="px-5 py-3 text-center font-semibold text-[#475569]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrograms.map((prog) => (
                    <tr key={prog.id} className="border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f8fafc]">
                      <td className="px-5 py-4 font-semibold text-[#0f172a]">{prog.name}</td>
                      <td className="px-5 py-4 text-[#475569]">{prog.code}</td>
                      <td className="px-5 py-4 text-[#475569]">{departmentName(prog.departmentId)}</td>
                      <td className="px-5 py-4 text-[#475569]">{prog.years}</td>
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
                    <th className="px-5 py-3 text-center font-semibold text-[#475569]">Actions</th>
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
                    <th className="px-5 py-3 text-center font-semibold text-[#475569]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubjects.map((subject) => (
                    <tr key={subject.id} className="border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f8fafc]">
                      <td className="px-5 py-4 font-semibold text-[#0f172a]">{subject.name}</td>
                      <td className="px-5 py-4 text-[#475569]">{subject.code}</td>
                      <td className="px-5 py-4 text-[#475569]">{subject.credits}</td>
                      <td className="px-5 py-4 text-[#475569]">{semesters.find((s) => s.id === subject.semesterId)?.name ?? 'Unknown'}</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

      {/* Department modal */}
      <Modal open={deptModalOpen} title={editingDept ? 'Edit department' : 'Add department'} onClose={() => setDeptModalOpen(false)}>
        <form
          onSubmit={deptForm.handleSubmit((values) => {
            if (editingDept) {
              setDepartments((prev) => prev.map((d) => (d.id === editingDept.id ? { ...d, ...values } : d)))
              showToast(`${values.name} updated.`)
            } else {
              setDepartments((prev) => [{ id: nextId('dept'), ...values }, ...prev])
              showToast(`${values.name} added.`)
            }
            setDeptModalOpen(false)
          })}
          noValidate
        >
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
            <button type="submit" className="rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b]">
              {editingDept ? 'Save changes' : 'Add department'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Program modal */}
      <Modal open={progModalOpen} title={editingProg ? 'Edit program' : 'Add program'} onClose={() => setProgModalOpen(false)}>
        <form
          onSubmit={progForm.handleSubmit((values) => {
            if (editingProg) {
              setPrograms((prev) => prev.map((p) => (p.id === editingProg.id ? { ...p, ...values } : p)))
              showToast(`${values.name} updated.`)
            } else {
              setPrograms((prev) => [{ id: nextId('prog'), ...values }, ...prev])
              showToast(`${values.name} added.`)
            }
            setProgModalOpen(false)
          })}
          noValidate
        >
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
            <button type="submit" className="rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b]">
              {editingProg ? 'Save changes' : 'Add program'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Semester modal */}
      <Modal open={semModalOpen} title={editingSem ? 'Edit semester' : 'Add semester'} onClose={() => setSemModalOpen(false)}>
        <form
          onSubmit={semForm.handleSubmit((values) => {
            if (editingSem) {
              setSemesters((prev) => prev.map((s) => (s.id === editingSem.id ? { ...s, ...values } : s)))
              showToast(`${values.name} updated.`)
            } else {
              setSemesters((prev) => [{ id: nextId('sem'), ...values }, ...prev])
              showToast(`${values.name} added.`)
            }
            setSemModalOpen(false)
          })}
          noValidate
        >
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
            <button type="submit" className="rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b]">
              {editingSem ? 'Save changes' : 'Add semester'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Subject modal */}
      <Modal open={subjModalOpen} title={editingSubj ? 'Edit subject' : 'Add subject'} onClose={() => setSubjModalOpen(false)}>
        <form
          onSubmit={subjForm.handleSubmit((values) => {
            if (editingSubj) {
              setSubjects((prev) => prev.map((s) => (s.id === editingSubj.id ? { ...s, ...values } : s)))
              showToast(`${values.name} updated.`)
            } else {
              setSubjects((prev) => [{ id: nextId('subj'), ...values }, ...prev])
              showToast(`${values.name} added.`)
            }
            setSubjModalOpen(false)
          })}
          noValidate
        >
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
            <button type="submit" className="rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b]">
              {editingSubj ? 'Save changes' : 'Add subject'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deletingDept}
        title="Delete department"
        description={`Delete ${deletingDept?.name ?? ''}? Programs under this department will not be reassigned automatically.`}
        confirmLabel="Delete"
        onConfirm={() => {
          setDepartments((prev) => prev.filter((d) => d.id !== deletingDept?.id))
          showToast(`${deletingDept?.name} deleted.`)
          setDeletingDept(null)
        }}
        onCancel={() => setDeletingDept(null)}
      />
      <ConfirmDialog
        open={!!deletingProg}
        title="Delete program"
        description={`Delete ${deletingProg?.name ?? ''}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          setPrograms((prev) => prev.filter((p) => p.id !== deletingProg?.id))
          showToast(`${deletingProg?.name} deleted.`)
          setDeletingProg(null)
        }}
        onCancel={() => setDeletingProg(null)}
      />
      <ConfirmDialog
        open={!!deletingSem}
        title="Delete semester"
        description={`Delete ${deletingSem?.name ?? ''}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          setSemesters((prev) => prev.filter((s) => s.id !== deletingSem?.id))
          showToast(`${deletingSem?.name} deleted.`)
          setDeletingSem(null)
        }}
        onCancel={() => setDeletingSem(null)}
      />
      <ConfirmDialog
        open={!!deletingSubj}
        title="Delete subject"
        description={`Delete ${deletingSubj?.name ?? ''}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          setSubjects((prev) => prev.filter((s) => s.id !== deletingSubj?.id))
          showToast(`${deletingSubj?.name} deleted.`)
          setDeletingSubj(null)
        }}
        onCancel={() => setDeletingSubj(null)}
      />
    </div>
  )
}
