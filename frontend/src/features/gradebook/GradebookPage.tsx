import { useEffect, useState, useMemo } from 'react'
import {
  TableProperties,
  Save,
  Send,
  Sparkles,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  BookOpen,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import {
  getGradebookMatrix,
  saveGradebookMatrix,
  type GradebookMatrixResponse,
  type GradebookStudentRow,
} from '@/api/gradebook'
import { ApiRequestError } from '@/api/client'

const gradeBadgeColors: Record<string, string> = {
  O: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'A+': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  A: 'bg-purple-50 text-purple-700 border-purple-200',
  'B+': 'bg-sky-50 text-sky-700 border-sky-200',
  B: 'bg-teal-50 text-teal-700 border-teal-200',
  C: 'bg-amber-50 text-amber-700 border-amber-200',
  F: 'bg-rose-50 text-rose-700 border-rose-200',
}

function calculateGrade(total: number) {
  if (total >= 90) return { grade: 'O', gradePoints: 10 }
  if (total >= 80) return { grade: 'A+', gradePoints: 9 }
  if (total >= 70) return { grade: 'A', gradePoints: 8 }
  if (total >= 60) return { grade: 'B+', gradePoints: 7 }
  if (total >= 50) return { grade: 'B', gradePoints: 6 }
  if (total >= 40) return { grade: 'C', gradePoints: 5 }
  return { grade: 'F', gradePoints: 0 }
}

export default function GradebookPage() {
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [data, setData] = useState<GradebookMatrixResponse | null>(null)
  const [selectedProgramId, setSelectedProgramId] = useState('')
  const [selectedSemesterId, setSelectedSemesterId] = useState('')
  const [selectedSubjectCode, setSelectedSubjectCode] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'passed' | 'grace' | 'failed'>('all')

  // Editable rows state
  const [rows, setRows] = useState<GradebookStudentRow[]>([])
  const [isDirty, setIsDirty] = useState(false)

  // Load Gradebook
  async function loadGradebook(progId?: string, semId?: string, subCode?: string) {
    setLoading(true)
    try {
      const response = await getGradebookMatrix({
        programId: progId || selectedProgramId || undefined,
        semesterId: semId || selectedSemesterId || undefined,
        subjectCode: subCode || selectedSubjectCode || undefined,
      })
      setData(response)
      setRows(response.students)
      setIsDirty(false)

      if (response.selectedProgram) setSelectedProgramId(response.selectedProgram.id)
      if (response.selectedSemester) setSelectedSemesterId(response.selectedSemester.id)
      if (response.selectedSubject) setSelectedSubjectCode(response.selectedSubject.code)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to load gradebook', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGradebook()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleProgramChange(newProgramId: string) {
    setSelectedProgramId(newProgramId)
    setSelectedSemesterId('')
    setSelectedSubjectCode('')
    loadGradebook(newProgramId, '', '')
  }

  function handleSemesterChange(newSemesterId: string) {
    setSelectedSemesterId(newSemesterId)
    setSelectedSubjectCode('')
    loadGradebook(selectedProgramId, newSemesterId, '')
  }

  function handleSubjectChange(newSubjectCode: string) {
    setSelectedSubjectCode(newSubjectCode)
    loadGradebook(selectedProgramId, selectedSemesterId, newSubjectCode)
  }

  // Update cell mark
  function updateStudentMarks(
    studentId: string,
    field: 'internalMarks' | 'midSemMarks' | 'endSemMarks',
    rawValue: string
  ) {
    const num = Math.max(0, parseInt(rawValue, 10) || 0)
    setRows((prev) =>
      prev.map((r) => {
        if (r.studentId !== studentId) return r

        const maxLimits = { internalMarks: 30, midSemMarks: 20, endSemMarks: 50 }
        const clamped = Math.min(maxLimits[field], num)

        const internal = field === 'internalMarks' ? clamped : r.internalMarks
        const midSem = field === 'midSemMarks' ? clamped : r.midSemMarks
        const endSem = field === 'endSemMarks' ? clamped : r.endSemMarks

        let total = internal + midSem + endSem
        let graceMarksApplied = r.graceMarksApplied || 0
        let status: 'passed' | 'passed_with_grace' | 'failed' = 'passed'

        if (total >= 35 && total < 40) {
          graceMarksApplied = 40 - total
          total = 40
          status = 'passed_with_grace'
        } else if (total < 40) {
          status = 'failed'
          graceMarksApplied = 0
        } else {
          graceMarksApplied = 0
        }

        const { grade, gradePoints } = calculateGrade(total)

        return {
          ...r,
          [field]: clamped,
          totalMarks: total,
          grade,
          gradePoints,
          status,
          graceMarksApplied: graceMarksApplied > 0 ? graceMarksApplied : undefined,
          isCustomSaved: false, // marked modified
        }
      })
    )
    setIsDirty(true)
  }

  // Quick Action: Apply grace marks to all borderline students (35-39)
  function applyGraceToAll() {
    let count = 0
    setRows((prev) =>
      prev.map((r) => {
        const raw = r.internalMarks + r.midSemMarks + r.endSemMarks
        if (raw >= 35 && raw < 40) {
          count++
          return {
            ...r,
            totalMarks: 40,
            status: 'passed_with_grace',
            graceMarksApplied: 40 - raw,
            grade: 'C',
            gradePoints: 5,
            isCustomSaved: false,
          }
        }
        return r
      })
    )
    setIsDirty(true)
    if (count > 0) {
      showToast(`Grace marks applied for ${count} borderline students.`, 'success')
    } else {
      showToast('No students currently eligible for borderline grace marks in this subject.')
    }
  }

  // Save handler
  async function handleSave(submitForModeration = false) {
    if (!data?.selectedSubject) return

    if (submitForModeration) setSubmitting(true)
    else setSaving(true)

    try {
      const payload = {
        programId: selectedProgramId,
        semesterId: selectedSemesterId,
        subjectCode: data.selectedSubject.code,
        subjectName: data.selectedSubject.name,
        entries: rows.map((r) => ({
          studentId: r.studentId,
          internalMarks: r.internalMarks,
          midSemMarks: r.midSemMarks,
          endSemMarks: r.endSemMarks,
          graceMarksApplied: r.graceMarksApplied,
        })),
        submitForModeration,
      }

      const res = await saveGradebookMatrix(payload)
      setIsDirty(false)
      showToast(
        submitForModeration
          ? `Marks successfully submitted to HOD for formal moderation (${res.savedCount} students).`
          : `Gradebook draft successfully saved for ${res.savedCount} students.`,
        'success'
      )
      // Reload to reflect saved markers
      loadGradebook(selectedProgramId, selectedSemesterId, selectedSubjectCode)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to save gradebook.', 'error')
    } finally {
      setSaving(false)
      setSubmitting(false)
    }
  }

  // Filtered rows for table
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchesSearch =
        r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.studentCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.email.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false

      if (filterStatus === 'passed') return r.status === 'passed'
      if (filterStatus === 'grace') return r.status === 'passed_with_grace'
      if (filterStatus === 'failed') return r.status === 'failed'
      return true
    })
  }, [rows, searchQuery, filterStatus])

  // Statistics
  const stats = useMemo(() => {
    if (rows.length === 0) return { avg: 0, passRate: 0, passed: 0, failed: 0, grace: 0 }
    const totalSum = rows.reduce((acc, r) => acc + r.totalMarks, 0)
    const passed = rows.filter((r) => r.status === 'passed').length
    const grace = rows.filter((r) => r.status === 'passed_with_grace').length
    const failed = rows.filter((r) => r.status === 'failed').length
    return {
      avg: Math.round((totalSum / rows.length) * 10) / 10,
      passRate: Math.round(((passed + grace) / rows.length) * 1000) / 10,
      passed,
      grace,
      failed,
    }
  }, [rows])

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] p-6 text-white shadow-xl sm:p-8">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
              <TableProperties size={13} />
              Continuous Academic Assessment
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Faculty Gradebook Matrix
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Spreadsheet-style marks entry with live grade compilation, automatic condonation rules, and one-click moderation dispatch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isDirty && (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-300">
                <AlertTriangle size={13} />
                Unsaved edits
              </span>
            )}
            <button
              onClick={() => handleSave(false)}
              disabled={saving || submitting || rows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Draft
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving || submitting || rows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Submit to HOD
            </button>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-6 sm:grid-cols-4">
          <div className="rounded-xl bg-white/5 p-3 backdrop-blur">
            <span className="text-xs text-slate-400">Total Enrolled</span>
            <p className="font-display text-xl font-bold text-white">{rows.length}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3 backdrop-blur">
            <span className="text-xs text-slate-400">Class Average</span>
            <p className="font-display text-xl font-bold text-emerald-300">{stats.avg} / 100</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3 backdrop-blur">
            <span className="text-xs text-slate-400">Pass Rate</span>
            <p className="font-display text-xl font-bold text-indigo-300">{stats.passRate}%</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3 backdrop-blur">
            <span className="text-xs text-slate-400">Grace Applied</span>
            <p className="font-display text-xl font-bold text-purple-300">{stats.grace} students</p>
          </div>
        </div>
      </div>

      {/* Selectors & Filters */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Program Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Program:</span>
            <select
              value={selectedProgramId}
              onChange={(e) => handleProgramChange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
            >
              {data?.programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Semester Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Semester:</span>
            <select
              value={selectedSemesterId}
              onChange={(e) => handleSemesterChange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
            >
              {data?.semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (Year {s.year})
                </option>
              ))}
            </select>
          </div>

          {/* Subject Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Subject:</span>
            <select
              value={selectedSubjectCode}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
            >
              {data?.subjects.map((sub) => (
                <option key={sub.id} value={sub.code}>
                  {sub.code} - {sub.name} ({sub.credits} credits)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={applyGraceToAll}
            title="Automatically condone borderline students scoring 35-39 to 40 per university grace rules"
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 transition hover:bg-purple-100"
          >
            <Sparkles size={13} />
            Apply Grace (35-39)
          </button>
          <button
            onClick={() => loadGradebook()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            title="Reload from server"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Table search & status filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search students by name, roll no, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {(['all', 'passed', 'grace', 'failed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                filterStatus === st
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st === 'grace' ? 'Passed with Grace' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Gradebook Matrix Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
            <p className="text-xs font-medium text-slate-500">Compiling gradebook marks...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <BookOpen className="text-slate-300" size={36} />
            <p className="mt-2 text-sm font-semibold text-slate-700">No students found</p>
            <p className="text-xs text-slate-500">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 pl-6 pr-2">Student</th>
                  <th className="px-3 py-3.5 text-center">Internal (/30)</th>
                  <th className="px-3 py-3.5 text-center">Mid-Sem (/20)</th>
                  <th className="px-3 py-3.5 text-center">End-Sem (/50)</th>
                  <th className="px-3 py-3.5 text-center">Total (/100)</th>
                  <th className="px-3 py-3.5 text-center">Grade</th>
                  <th className="px-3 py-3.5 text-center">Status</th>
                  <th className="py-3.5 pl-2 pr-6 text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((stu) => {
                  return (
                    <tr key={stu.studentId} className="transition hover:bg-slate-50/60">
                      {/* Student info */}
                      <td className="py-3.5 pl-6 pr-2">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 font-display text-xs font-bold text-slate-700">
                            {stu.studentName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{stu.studentName}</p>
                            <p className="font-mono text-[10px] text-slate-500">
                              {stu.studentCode} • {stu.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Internal Input (/30) */}
                      <td className="px-3 py-3.5 text-center">
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={stu.internalMarks}
                          onChange={(e) => updateStudentMarks(stu.studentId, 'internalMarks', e.target.value)}
                          className="w-16 rounded-lg border border-slate-200 bg-white py-1 text-center font-mono text-xs font-semibold text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </td>

                      {/* Mid-Sem Input (/20) */}
                      <td className="px-3 py-3.5 text-center">
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={stu.midSemMarks}
                          onChange={(e) => updateStudentMarks(stu.studentId, 'midSemMarks', e.target.value)}
                          className="w-16 rounded-lg border border-slate-200 bg-white py-1 text-center font-mono text-xs font-semibold text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </td>

                      {/* End-Sem Input (/50) */}
                      <td className="px-3 py-3.5 text-center">
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={stu.endSemMarks}
                          onChange={(e) => updateStudentMarks(stu.studentId, 'endSemMarks', e.target.value)}
                          className="w-16 rounded-lg border border-slate-200 bg-white py-1 text-center font-mono text-xs font-semibold text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </td>

                      {/* Total */}
                      <td className="px-3 py-3.5 text-center">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {stu.totalMarks}
                        </span>
                      </td>

                      {/* Grade Badge */}
                      <td className="px-3 py-3.5 text-center">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 font-display text-xs font-bold ${
                            gradeBadgeColors[stu.grade] || 'bg-slate-50 text-slate-700'
                          }`}
                        >
                          {stu.grade} ({stu.gradePoints})
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="px-3 py-3.5 text-center">
                        {stu.status === 'passed_with_grace' ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                            <Sparkles size={10} />
                            Grace (+{stu.graceMarksApplied})
                          </span>
                        ) : stu.status === 'passed' ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            <CheckCircle2 size={10} />
                            Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                            Failed
                          </span>
                        )}
                      </td>

                      {/* Audit */}
                      <td className="py-3.5 pl-2 pr-6 text-right">
                        {stu.isCustomSaved ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                            <CheckCircle2 size={12} /> Saved
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-600 font-medium">
                            Draft
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info */}
        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/50 p-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Scores entered directly sync with official student marksheets, transcripts, and verified QR records.</span>
          </div>
          <span>Showing {filteredRows.length} of {rows.length} students</span>
        </div>
      </div>
    </div>
  )
}
