import { useEffect, useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Award,
  CheckCircle2,
  Download,
  Loader2,
  Printer,
  Search,
  ShieldCheck,
  XCircle,
  ExternalLink,
  Calculator,
  FileText,
  Clock,
  ShieldAlert,
  QrCode,
  Building2,
  GraduationCap,
  Calendar,
  Filter,
  RotateCcw,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import EmptyState from '@/components/ui/EmptyState'
import { triggerBlobDownload } from '@/utils/download'
import * as studentsApi from '@/api/students'
import * as departmentsApi from '@/api/departments'
import * as programsApi from '@/api/programs'
import type { StudentResultData, ResultWorkflowRecord } from '@/api/students'
import type { Department, Program, Student } from '@/types'
import { ApiRequestError } from '@/api/client'
import TargetCalculator from './TargetCalculator'
import WorkflowActionBar from './WorkflowActionBar'

const gradeBadgeColors: Record<string, string> = {
  O: 'bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]',
  'A+': 'bg-[#e0e7ff] text-[#4338ca] border-[#c7d2fe]',
  A: 'bg-[#ede9fe] text-[#6d28d9] border-[#ddd6fe]',
  'B+': 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]',
  B: 'bg-[#f0fdf4] text-[#166534] border-[#dcfce7]',
  C: 'bg-[#fef9c3] text-[#854d0e] border-[#fef08a]',
  F: 'bg-[#fee2e2] text-[#b91c1c] border-[#fecaca]',
}

export default function FinalResultsPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()
  const urlStudentId = searchParams.get('studentId')
  const isStudent = user?.role === 'student'
  const isFacultyOrHod = user?.role === 'faculty' || user?.role === 'hod'

  const [activeTab, setActiveTab] = useState<'marksheet' | 'calculator'>('marksheet')
  const [students, setStudents] = useState<Student[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  const [selectedProgram, setSelectedProgram] = useState<string>('all')
  const [selectedSemester, setSelectedSemester] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [result, setResult] = useState<StudentResultData | null>(null)
  const [workflow, setWorkflow] = useState<ResultWorkflowRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingResult, setLoadingResult] = useState(false)
  const [error, setError] = useState('')
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)

  // Load students, departments, programs & workflow status
  useEffect(() => {
    async function loadInitial() {
      setLoading(true)
      try {
        const [studentList, wfRecord, deptList, progList] = await Promise.all([
          studentsApi.list(),
          studentsApi.getWorkflowStatus('all').catch(() => null),
          isStudent ? Promise.resolve([]) : departmentsApi.list().catch(() => []),
          isStudent ? Promise.resolve([]) : programsApi.list().catch(() => []),
        ])
        setStudents(studentList)
        setDepartments(deptList)
        setPrograms(progList)
        if (wfRecord) setWorkflow(wfRecord)

        // Find user department for HOD / Faculty if applicable
        let initialDeptId = 'all'
        if (isFacultyOrHod && user?.department) {
          const userDept = deptList.find(
            (d) =>
              d.name.toLowerCase() === user.department?.toLowerCase() ||
              d.code.toLowerCase() === user.department?.toLowerCase()
          )
          if (userDept) {
            initialDeptId = userDept.id
            setSelectedDepartment(userDept.id)
          }
        }

        if (urlStudentId && studentList.some((s) => s.id === urlStudentId || s.studentId === urlStudentId)) {
          setSelectedStudentId(urlStudentId)
        } else if (isStudent) {
          const myId =
            user?.studentId ||
            studentList.find((s) => s.email.toLowerCase() === user?.email.toLowerCase())?.id ||
            studentList[0]?.id
          if (myId) setSelectedStudentId(myId)
        } else if (studentList.length > 0) {
          if (initialDeptId !== 'all') {
            const matching = studentList.filter((s) => {
              const prog = progList.find((p) => p.id === s.programId)
              return prog?.departmentId === initialDeptId
            })
            setSelectedStudentId(matching.length > 0 ? matching[0].id : studentList[0].id)
          } else {
            setSelectedStudentId(studentList[0].id)
          }
        }
      } catch (err) {
        setError(err instanceof ApiRequestError ? err.message : 'Failed to load students.')
      } finally {
        setLoading(false)
      }
    }

    loadInitial()
  }, [isStudent, isFacultyOrHod, user?.department, user?.email, user?.studentId, urlStudentId])

  // Available programs filtered by department
  const availablePrograms = useMemo(() => {
    if (selectedDepartment === 'all') return programs
    return programs.filter((p) => p.departmentId === selectedDepartment)
  }, [programs, selectedDepartment])

  // Available semesters filtered by program
  const availableSemesters = useMemo(() => {
    if (selectedProgram !== 'all') {
      const prog = programs.find((p) => p.id === selectedProgram)
      const count = (prog?.years ?? 4) * 2
      return Array.from({ length: count }, (_, i) => ({
        value: String(i + 1),
        label: `Semester ${i + 1} (Year ${Math.ceil((i + 1) / 2)})`,
      }))
    }
    return Array.from({ length: 8 }, (_, i) => ({
      value: String(i + 1),
      label: `Semester ${i + 1} (Year ${Math.ceil((i + 1) / 2)})`,
    }))
  }, [programs, selectedProgram])

  // Filtered student list based on Department, Program, Semester, and Quick Search
  const filteredStudents = useMemo(() => {
    if (isStudent) return students

    return students.filter((s) => {
      // 1. Department filter
      if (selectedDepartment !== 'all') {
        const prog = programs.find((p) => p.id === s.programId)
        if (prog && prog.departmentId !== selectedDepartment) return false
      }
      // 2. Program filter
      if (selectedProgram !== 'all' && s.programId !== selectedProgram) {
        return false
      }
      // 3. Semester filter (semesters 1-2 = Year 1, 3-4 = Year 2, 5-6 = Year 3, 7-8 = Year 4)
      if (selectedSemester !== 'all') {
        const semNum = Number(selectedSemester)
        const expectedYear = Math.ceil(semNum / 2)
        if (s.year !== expectedYear) return false
      }
      // 4. Quick text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matches =
          s.name.toLowerCase().includes(q) ||
          s.studentId.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q)
        if (!matches) return false
      }
      return true
    })
  }, [students, programs, selectedDepartment, selectedProgram, selectedSemester, searchQuery, isStudent])

  // Auto-sync selectedStudentId when filtered list changes
  useEffect(() => {
    if (isStudent || loading) return
    if (filteredStudents.length === 0) {
      if (selectedStudentId !== '') setSelectedStudentId('')
    } else if (!filteredStudents.some((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(filteredStudents[0].id)
    }
  }, [filteredStudents, selectedStudentId, isStudent, loading])

  // User's department matching
  const userDept = departments.find(
    (d) =>
      d.name.toLowerCase() === user?.department?.toLowerCase() ||
      d.code.toLowerCase() === user?.department?.toLowerCase()
  )
  const defaultDepartmentId = isFacultyOrHod && userDept ? userDept.id : 'all'

  function handleDepartmentChange(deptId: string) {
    setSelectedDepartment(deptId)
    setSelectedProgram('all')
    setSelectedSemester('all')
  }

  function handleProgramChange(progId: string) {
    setSelectedProgram(progId)
    setSelectedSemester('all')
  }

  function resetFilters() {
    setSelectedDepartment(defaultDepartmentId)
    setSelectedProgram('all')
    setSelectedSemester('all')
    setSearchQuery('')
  }

  // Load marksheet whenever selected student changes
  useEffect(() => {
    if (!selectedStudentId) {
      setResult(null)
      return
    }

    let active = true
    async function fetchResult() {
      setLoadingResult(true)
      setError('')
      try {
        const data = await studentsApi.getResult(selectedStudentId)
        if (active) setResult(data)
      } catch (err) {
        if (active) {
          setError(err instanceof ApiRequestError ? err.message : 'Failed to generate result marksheet.')
        }
      } finally {
        if (active) setLoadingResult(false)
      }
    }

    fetchResult()
    return () => {
      active = false
    }
  }, [selectedStudentId])

  async function handleDownloadPdf() {
    if (!selectedStudentId || !result) return
    setIsDownloadingPdf(true)
    try {
      const { blob, filename } = await studentsApi.downloadResultPdf(selectedStudentId)
      triggerBlobDownload(blob, filename)
      showToast('Official Marksheet PDF downloaded.')
    } catch {
      showToast('Failed to download marksheet PDF.', 'error')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-[#4f46e5]" size={36} />
        <p className="text-sm font-semibold text-[#475569]">Loading academic results...</p>
      </div>
    )
  }

  // Student under moderation lock
  const isStudentRestricted = isStudent && workflow && workflow.status !== 'published'

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-16 pt-8 sm:px-9 lg:px-12">
      {/* Page Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end print:hidden">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 items-center gap-1.5 rounded-full bg-[#eef2ff] px-2.5 text-[11px] font-bold uppercase tracking-wider text-[#4338ca]">
              <Award size={13} /> Examination Controller
            </span>
            <span className="text-xs text-[#94a3b8]">Verified by RuleCraft AI</span>
          </div>
          <h1 className="font-display text-[30px] font-bold tracking-tight text-[#0f172a] sm:text-[36px]">
            Final Results & Marksheet
          </h1>
          <p className="mt-1 text-sm text-[#475569]">
            {isStudent
              ? 'Your official semester performance, subject grades, GPA, and automated regulation compliance audit.'
              : 'Official semester performance, subject grades, GPA, and automated regulation compliance audit.'}
          </p>
        </div>

        {/* Top Actions */}
        {result && !isStudentRestricted && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg border border-[#cbd5e1] bg-white px-3.5 py-2.5 text-xs font-bold text-[#334155] shadow-xs transition hover:bg-[#f8fafc]"
            >
              <Printer size={15} /> Print Marksheet
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="flex items-center gap-2 rounded-lg bg-[#4338ca] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#3730a3] disabled:opacity-70"
            >
              {isDownloadingPdf ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              Download Official PDF
            </button>
          </div>
        )}
      </div>

      {/* Staff Lifecycle / Workflow Action Bar */}
      {!isStudent && (
        <div className="mb-6 print:hidden">
          <WorkflowActionBar
            workflow={workflow}
            onWorkflowUpdated={(updated) => {
              setWorkflow(updated)
              if (result) setResult({ ...result, publicationStatus: updated.status })
            }}
          />
        </div>
      )}

      {/* Cascading Filter Bar: Department -> Program -> Semester -> Student (Staff only) */}
      {!isStudent && (
        <div className="mb-6 rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-xs print:hidden">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#f1f5f9] pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#eef2ff] text-[#4f46e5]">
                <Filter size={14} />
              </span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#0f172a]">
                Student Academic Filter & Selector
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold text-[#64748b]">
                Showing <span className="font-bold text-[#0f172a]">{filteredStudents.length}</span> of {students.length} students
              </span>
              {(selectedDepartment !== defaultDepartmentId ||
                selectedProgram !== 'all' ||
                selectedSemester !== 'all' ||
                searchQuery.trim() !== '') && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 font-semibold text-[#4f46e5] hover:text-[#3730a3] hover:underline"
                >
                  <RotateCcw size={12} /> Reset filters
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. Department */}
            <div>
              <label htmlFor="filter-dept" className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                <Building2 size={13} className="text-[#64748b]" /> Department
              </label>
              <select
                id="filter-dept"
                value={selectedDepartment}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                disabled={isFacultyOrHod && !!userDept}
                className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold text-[#0f172a] outline-none transition focus:border-[#4f46e5] disabled:bg-[#f8fafc] disabled:text-[#64748b]"
              >
                {!isFacultyOrHod && <option value="all">All Departments</option>}
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Program */}
            <div>
              <label htmlFor="filter-prog" className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                <GraduationCap size={13} className="text-[#64748b]" /> Program
              </label>
              <select
                id="filter-prog"
                value={selectedProgram}
                onChange={(e) => handleProgramChange(e.target.value)}
                className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold text-[#0f172a] outline-none transition focus:border-[#4f46e5]"
              >
                <option value="all">All Programs</option>
                {availablePrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Semester */}
            <div>
              <label htmlFor="filter-sem" className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                <Calendar size={13} className="text-[#64748b]" /> Semester
              </label>
              <select
                id="filter-sem"
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold text-[#0f172a] outline-none transition focus:border-[#4f46e5]"
              >
                <option value="all">All Semesters</option>
                {availableSemesters.map((sem) => (
                  <option key={sem.value} value={sem.value}>
                    {sem.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Student */}
            <div>
              <label htmlFor="student-picker" className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                <Search size={13} className="text-[#64748b]" /> Select Student
              </label>
              <select
                id="student-picker"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                disabled={filteredStudents.length === 0}
                className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold text-[#0f172a] outline-none transition focus:border-[#4f46e5] disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
              >
                {filteredStudents.length === 0 ? (
                  <option value="" disabled>No students match filters</option>
                ) : (
                  filteredStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.studentId}) — Year {s.year} • GPA {s.gpa.toFixed(1)}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Quick search input */}
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1.5">
            <Search size={13} className="text-[#94a3b8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Quick search by name, student ID (e.g. STU2024002), or email..."
              className="flex-1 bg-transparent text-xs text-[#0f172a] placeholder-[#94a3b8] outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-[11px] font-semibold text-[#64748b] hover:text-[#0f172a]"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab Switcher: Official Grade Card vs What-If Simulator */}
      {result && !isStudentRestricted && (
        <div className="mb-6 flex items-center gap-2 border-b border-[#e2e8f0] pb-2 print:hidden">
          <button
            onClick={() => setActiveTab('marksheet')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all ${
              activeTab === 'marksheet'
                ? 'bg-[#0f172a] text-white shadow-xs'
                : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]'
            }`}
          >
            <FileText size={15} />
            <span>Official Marksheet & Grade Report</span>
          </button>
          <button
            onClick={() => setActiveTab('calculator')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all ${
              activeTab === 'calculator'
                ? 'bg-[#4338ca] text-white shadow-xs'
                : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]'
            }`}
          >
            <Calculator size={15} />
            <span>🎯 What-If Target CGPA Calculator</span>
          </button>
        </div>
      )}

      {/* Main Marksheet View */}
      {isStudentRestricted ? (
        <div className="rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-8 text-center shadow-xs">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#fef3c7] text-[#d97706]">
            <Clock size={32} />
          </div>
          <h2 className="font-display text-lg font-bold text-[#92400e]">
            Official Results Under Board Moderation
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-[#78350f]">
            Semester results are currently being moderated by the Department Examination Committee and will be published once officially signed off by the Registrar.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#fde68a] bg-white px-3 py-1 text-xs font-bold text-[#b45309]">
            <ShieldAlert size={14} /> Current Status: {workflow?.status.toUpperCase().replace('_', ' ')}
          </div>
        </div>
      ) : loadingResult ? (
        <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white shadow-xs">
          <Loader2 className="animate-spin text-[#4f46e5]" size={36} />
          <p className="text-sm font-semibold text-[#475569]">Compiling subject scores & evaluating regulations...</p>
        </div>
      ) : error ? (
        <EmptyState
          icon={XCircle}
          title="Could not load final marksheet"
          description={error}
        />
      ) : result ? (
        activeTab === 'calculator' ? (
          <TargetCalculator initialData={result} />
        ) : (
          <div className="space-y-6">
            {/* The Official Printed Marksheet Container */}
            <div className="overflow-hidden rounded-2xl border border-[#cbd5e1] bg-white p-6 shadow-xs sm:p-10 print:border-none print:p-0 print:shadow-none">
              {/* University Emblem Header */}
              <div className="border-b-2 border-[#0f172a] pb-6 text-center">
                <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4338ca] shadow-xs">
                  <Award size={30} />
                </div>
                <h2 className="font-display text-2xl font-black tracking-tight text-[#0f172a] sm:text-3xl">
                  NORTHBRIDGE UNIVERSITY
                </h2>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-[#64748b]">
                  Office of the Controller of Academic Examinations
                </p>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#c7d2fe] bg-[#eef2ff] px-3.5 py-1 text-xs font-black text-[#4338ca]">
                  OFFICIAL GRADE REPORT & MARKSHEET
                </div>
              </div>

              {/* Student Profile Card & QR Verification Stamp */}
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="col-span-3 grid grid-cols-2 gap-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-5 text-xs sm:grid-cols-4">
                  <div>
                    <p className="text-[#94a3b8]">Student Name</p>
                    <p className="mt-0.5 text-sm font-bold text-[#0f172a]">{result.student.name}</p>
                  </div>
                  <div>
                    <p className="text-[#94a3b8]">Student ID (Roll No.)</p>
                    <p className="mt-0.5 font-mono text-sm font-bold text-[#4338ca]">{result.student.studentId}</p>
                  </div>
                  <div>
                    <p className="text-[#94a3b8]">Department & Program</p>
                    <p className="mt-0.5 font-semibold text-[#0f172a]">
                      {result.student.departmentName} ({result.student.programCode})
                    </p>
                  </div>
                  <div>
                    <p className="text-[#94a3b8]">Semester / Status</p>
                    <p className="mt-0.5 font-semibold text-[#0f172a]">
                      {result.student.semesterName} •{' '}
                      <span className={result.student.status === 'active' ? 'font-bold text-[#16a34a]' : 'font-bold text-[#dc2626]'}>
                        {result.student.status.toUpperCase()}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Scannable Verification Card */}
                <div className="col-span-1 flex flex-col items-center justify-center rounded-xl border border-[#c7d2fe] bg-[#f5f7ff] p-3 text-center">
                  {result.verification?.qrCodeDataUrl ? (
                    <img
                      src={result.verification.qrCodeDataUrl}
                      alt="Verification QR Code"
                      className="h-20 w-20 rounded-lg border border-[#cbd5e1] bg-white p-1 shadow-2xs"
                    />
                  ) : (
                    <QrCode size={36} className="text-[#4338ca]" />
                  )}
                  <p className="mt-1.5 text-[10px] font-bold text-[#3730a3]">SCAN TO VERIFY</p>
                  <Link
                    to={`/verify/${result.verification?.token}`}
                    target="_blank"
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-extrabold text-[#4338ca] hover:underline"
                  >
                    <span>Public Ledger</span>
                    <ExternalLink size={11} />
                  </Link>
                </div>
              </div>

              {/* Academic Totals Metric Strip */}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 text-center shadow-xs">
                  <p className="text-xs font-medium text-[#64748b]">Total Marks</p>
                  <p className="mt-1 font-display text-2xl font-black text-[#0f172a]">
                    {result.academicSummary.totalMarksObtained}{' '}
                    <span className="text-xs font-normal text-[#94a3b8]">/ {result.academicSummary.maxTotalMarks}</span>
                  </p>
                </div>
                <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 text-center shadow-xs">
                  <p className="text-xs font-medium text-[#64748b]">Percentage</p>
                  <p className="mt-1 font-display text-2xl font-black text-[#0f172a]">{result.academicSummary.percentage}%</p>
                </div>
                <div className="rounded-xl border border-[#c7d2fe] bg-[#eef2ff] p-4 text-center shadow-xs">
                  <p className="text-xs font-bold text-[#4338ca]">Semester SGPA</p>
                  <p className="mt-1 font-display text-2xl font-black text-[#4338ca]">{result.academicSummary.sgpa.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-[#c7d2fe] bg-[#eef2ff] p-4 text-center shadow-xs">
                  <p className="text-xs font-bold text-[#4338ca]">Cumulative CGPA</p>
                  <p className="mt-1 font-display text-2xl font-black text-[#4338ca]">{result.academicSummary.cgpa.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-center shadow-xs">
                  <p className="text-xs font-bold text-[#166534]">Credits Earned</p>
                  <p className="mt-1 font-display text-2xl font-black text-[#166534]">
                    {result.academicSummary.creditsEarned} / {result.academicSummary.totalCredits}
                  </p>
                </div>
              </div>

              {/* Subject Breakdown Table */}
              <div className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#475569]">
                    Detailed Subject-Wise Performance
                  </h3>
                  <span className="text-xs text-[#94a3b8]">
                    {result.subjects.length} Subjects Evaluated
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#e2e8f0]">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[11px] font-bold text-[#475569]">
                        <th className="py-3 pl-5 pr-2">Subject Code</th>
                        <th className="px-3 py-3">Subject Title</th>
                        <th className="px-3 py-3 text-center">Credits</th>
                        <th className="px-3 py-3 text-center">Max Marks</th>
                        <th className="px-3 py-3 text-center">Marks Obtained</th>
                        <th className="px-3 py-3 text-center">Letter Grade</th>
                        <th className="px-3 py-3 text-center">Grade Points</th>
                        <th className="py-3 pl-2 pr-5 text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9]">
                      {result.subjects.map((sub) => (
                        <tr key={sub.code} className="transition-colors hover:bg-[#f8fafc]">
                          <td className="py-3.5 pl-5 pr-2 font-mono font-bold text-[#0f172a]">{sub.code}</td>
                          <td className="px-3 py-3.5 font-semibold text-[#1e293b]">
                            {sub.name}
                            {sub.graceMarksApplied && (
                              <span className="ml-2 inline-flex items-center rounded bg-[#fef3c7] px-1.5 py-0.5 text-[10px] font-bold text-[#b45309]">
                                +{sub.graceMarksApplied} Grace Marks
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center text-[#475569]">{sub.credits}</td>
                          <td className="px-3 py-3.5 text-center text-[#94a3b8]">{sub.maxMarks}</td>
                          <td className="px-3 py-3.5 text-center font-bold text-[#0f172a]">
                            {sub.marksObtained}
                            {sub.graceMarksApplied && <span className="text-[#d97706]">*</span>}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <span
                              className={`inline-block min-w-9 rounded-full border px-2.5 py-0.5 text-center font-black ${
                                gradeBadgeColors[sub.grade] ?? 'bg-[#f1f5f9] text-[#475569]'
                              }`}
                            >
                              {sub.grade}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 text-center font-bold text-[#334155]">{sub.gradePoints}</td>
                          <td className="py-3.5 pl-2 pr-5 text-right">
                            {sub.status === 'passed_with_grace' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-[#fef3c7] px-2 py-0.5 text-[11px] font-bold text-[#b45309]">
                                Passed*
                              </span>
                            ) : sub.status === 'failed' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-[#fee2e2] px-2 py-0.5 text-[11px] font-bold text-[#dc2626]">
                                Failed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-[#dcfce7] px-2 py-0.5 text-[11px] font-bold text-[#16a34a]">
                                Passed
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RuleCraft AI Regulation Decision Card */}
              <div
                className={`mt-8 rounded-xl border p-5 ${
                  result.regulationVerdict.outcome === 'detained'
                    ? 'border-[#fecaca] bg-[#fef2f2]'
                    : result.regulationVerdict.outcome === 'promoted_with_atkt'
                      ? 'border-[#fef08a] bg-[#fefce8]'
                      : 'border-[#bbf7d0] bg-[#f0fdf4]'
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      size={22}
                      className={
                        result.regulationVerdict.outcome === 'detained' ? 'text-[#dc2626]' : 'text-[#16a34a]'
                      }
                    />
                    <h4
                      className={`text-xs font-black uppercase tracking-wider ${
                        result.regulationVerdict.outcome === 'detained' ? 'text-[#991b1b]' : 'text-[#166534]'
                      }`}
                    >
                      Automated Regulation Evaluation Verdict ({result.regulationVerdict.regulationCode})
                    </h4>
                  </div>
                  <span className="font-mono text-[11px] text-[#64748b]">
                    Evaluated on {new Date(result.generatedAt).toLocaleDateString()}
                  </span>
                </div>

                <p className="mt-2 font-display text-lg font-black text-[#0f172a]">
                  {result.regulationVerdict.outcomeLabel}
                </p>
                <p className="mt-0.5 text-xs text-[#475569]">
                  Applied Policy: <span className="font-semibold text-[#0f172a]">{result.regulationVerdict.regulationName}</span>
                </p>

                {/* Evaluated Rules Pill Strip */}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[#0000000a] pt-3">
                  {result.regulationVerdict.ruleEvaluations.map((r, i) => (
                    <div
                      key={i}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                        r.passed
                          ? 'border-[#bbf7d0] bg-white text-[#15803d]'
                          : 'border-[#fecaca] bg-white text-[#b91c1c]'
                      }`}
                    >
                      {r.passed ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                      <span>{r.ruleName}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Marksheet Official Verification Footer */}
              <div className="mt-10 flex flex-col items-center justify-between gap-6 border-t border-[#e2e8f0] pt-6 sm:flex-row">
                <div>
                  <p className="text-xs font-bold text-[#0f172a]">OFFICE OF THE CONTROLLER OF EXAMINATIONS</p>
                  <p className="text-[11px] text-[#64748b]">Northbridge University • Central Evaluation Board</p>
                  <p className="mt-1 text-[10px] text-[#94a3b8]">
                    Certificate No: <span className="font-mono">{result.verification?.certificateNo}</span>
                  </p>
                </div>
                <div className="text-center sm:text-right">
                  <div className="inline-block border-b border-[#0f172a] pb-1 font-serif text-sm italic text-[#0f172a]">
                    Prof. Neha Iyer
                  </div>
                  <p className="mt-1 text-xs font-bold text-[#0f172a]">Controller of Examinations</p>
                  <p className="text-[11px] font-medium text-[#16a34a]">✓ Digitally Authenticated Record</p>
                </div>
              </div>
            </div>
          </div>
        )
      ) : !isStudent && (!selectedStudentId || filteredStudents.length === 0) ? (
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-12 text-center shadow-xs">
          <EmptyState
            icon={Search}
            title="No students match the selected filters"
            description="Try selecting a different Department, Program, or Semester to view marksheet results."
            action={{
              label: 'Reset all filters',
              onClick: resetFilters,
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
