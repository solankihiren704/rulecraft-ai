import { useEffect, useState } from 'react'
import { Award, CheckCircle2, Download, Loader2, Printer, ShieldCheck, XCircle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/contexts/ToastContext'
import { triggerBlobDownload } from '@/utils/download'
import * as studentsApi from '@/api/students'
import type { StudentResultData } from '@/api/students'
import { ApiRequestError } from '@/api/client'

interface FinalResultModalProps {
  studentId: string | null
  studentName?: string
  open: boolean
  onClose: () => void
}

const gradeBadgeColors: Record<string, string> = {
  O: 'bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]',
  'A+': 'bg-[#e0e7ff] text-[#4338ca] border-[#c7d2fe]',
  A: 'bg-[#ede9fe] text-[#6d28d9] border-[#ddd6fe]',
  'B+': 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]',
  B: 'bg-[#f0fdf4] text-[#166534] border-[#dcfce7]',
  C: 'bg-[#fef9c3] text-[#854d0e] border-[#fef08a]',
  F: 'bg-[#fee2e2] text-[#b91c1c] border-[#fecaca]',
}

export default function FinalResultModal({ studentId, studentName, open, onClose }: FinalResultModalProps) {
  const { showToast } = useToast()
  const [data, setData] = useState<StudentResultData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)

  useEffect(() => {
    if (!open || !studentId) {
      setData(null)
      setError('')
      return
    }

    let isMounted = true
    async function fetchResult() {
      setLoading(true)
      setError('')
      try {
        const res = await studentsApi.getResult(studentId!)
        if (isMounted) setData(res)
      } catch (err) {
        if (isMounted) {
          setError(err instanceof ApiRequestError ? err.message : 'Failed to generate final marksheet.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchResult()
    return () => {
      isMounted = false
    }
  }, [open, studentId])

  async function handleDownloadPdf() {
    if (!studentId || !data) return
    setIsDownloadingPdf(true)
    try {
      const { blob, filename } = await studentsApi.downloadResultPdf(studentId)
      triggerBlobDownload(blob, filename)
      showToast('Marksheet PDF downloaded successfully.')
    } catch {
      showToast('Failed to download marksheet PDF.', 'error')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  return (
    <Modal
      open={open}
      title=""
      onClose={onClose}
      widthClassName="max-w-4xl"
    >
      {loading ? (
        <div className="flex h-72 flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-[#4f46e5]" size={36} />
          <p className="text-sm font-semibold text-[#475569]">Generating official marksheet & evaluating regulations...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center">
          <XCircle size={40} className="mx-auto mb-3 text-[#dc2626]" />
          <h3 className="text-base font-bold text-[#0f172a]">Could not load result</h3>
          <p className="mt-1 text-sm text-[#64748b]">{error}</p>
          <button
            onClick={onClose}
            className="mt-5 rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b]"
          >
            Close
          </button>
        </div>
      ) : data ? (
        <div className="space-y-6 print:p-0">
          {/* Official University Header */}
          <div className="border-b border-[#e2e8f0] pb-4 text-center">
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
              <Award size={24} />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-[#0f172a]">NORTHBRIDGE UNIVERSITY</h2>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">Office of the Controller of Examinations</p>
            <p className="mt-1 text-xs font-bold text-[#4338ca]">OFFICIAL SEMESTER GRADE REPORT & MARKSHEET</p>
          </div>

          {/* Student Profile Card */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-xs sm:grid-cols-4">
            <div>
              <p className="text-[#94a3b8]">Student Name</p>
              <p className="font-bold text-[#0f172a]">{data.student.name || studentName || '—'}</p>
            </div>
            <div>
              <p className="text-[#94a3b8]">Student ID (Roll No.)</p>
              <p className="font-mono font-bold text-[#4338ca]">{data.student.studentId}</p>
            </div>
            <div>
              <p className="text-[#94a3b8]">Program & Department</p>
              <p className="font-semibold text-[#0f172a]">
                {data.student.programCode} • {data.student.departmentName}
              </p>
            </div>
            <div>
              <p className="text-[#94a3b8]">Semester / Status</p>
              <p className="font-semibold text-[#0f172a]">
                {data.student.semesterName} •{' '}
                <span className={data.student.status === 'active' ? 'font-bold text-[#16a34a]' : 'font-bold text-[#dc2626]'}>
                  {data.student.status.toUpperCase()}
                </span>
                {data.student.attendance != null && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded bg-[#f1f5f9] px-2 py-0.5 text-xs font-semibold text-[#334155]">
                    Attendance:{' '}
                    <span className={data.student.attendance >= 75 ? 'text-[#16a34a]' : data.student.attendance >= 65 ? 'text-[#d97706]' : 'text-[#dc2626]'}>
                      {Math.round(data.student.attendance)}%
                    </span>
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Academic Totals Metric Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-3 text-center shadow-xs">
              <p className="text-[11px] font-medium text-[#64748b]">Total Marks</p>
              <p className="mt-0.5 text-lg font-extrabold text-[#0f172a]">
                {data.academicSummary.totalMarksObtained}{' '}
                <span className="text-xs font-normal text-[#94a3b8]">/ {data.academicSummary.maxTotalMarks}</span>
              </p>
            </div>
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-3 text-center shadow-xs">
              <p className="text-[11px] font-medium text-[#64748b]">Percentage</p>
              <p className="mt-0.5 text-lg font-extrabold text-[#0f172a]">{data.academicSummary.percentage}%</p>
            </div>
            <div className="rounded-xl border border-[#c7d2fe] bg-[#eef2ff] p-3 text-center shadow-xs">
              <p className="text-[11px] font-semibold text-[#4338ca]">Semester SGPA</p>
              <p className="mt-0.5 text-lg font-black text-[#4338ca]">{data.academicSummary.sgpa.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-[#c7d2fe] bg-[#eef2ff] p-3 text-center shadow-xs">
              <p className="text-[11px] font-semibold text-[#4338ca]">Cumulative CGPA</p>
              <p className="mt-0.5 text-lg font-black text-[#4338ca]">{data.academicSummary.cgpa.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-center shadow-xs">
              <p className="text-[11px] font-semibold text-[#166534]">Credits Earned</p>
              <p className="mt-0.5 text-lg font-black text-[#15803d]">
                {data.academicSummary.creditsEarned} <span className="text-xs font-normal text-[#86efac]">/ {data.academicSummary.totalCredits}</span>
              </p>
            </div>
          </div>

          {/* Subject-Wise Marksheet Table */}
          <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-xs">
            <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569]">Subject Performance & Grade Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f1f5f9] text-[11px] font-bold text-[#475569]">
                    <th className="py-2.5 pl-4 pr-2">Code</th>
                    <th className="px-3 py-2.5">Subject Title</th>
                    <th className="px-2 py-2.5 text-center">Credits</th>
                    <th className="px-2 py-2.5 text-center">Max</th>
                    <th className="px-2 py-2.5 text-center">Marks Obtained</th>
                    <th className="px-2 py-2.5 text-center">Letter Grade</th>
                    <th className="px-2 py-2.5 text-center">Grade Points</th>
                    <th className="py-2.5 pl-2 pr-4 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {data.subjects.map((sub) => (
                    <tr key={sub.code} className="hover:bg-[#f8fafc]">
                      <td className="py-3 pl-4 pr-2 font-mono font-bold text-[#0f172a]">{sub.code}</td>
                      <td className="px-3 py-3 font-semibold text-[#1e293b]">
                        {sub.name}
                        {sub.graceMarksApplied && (
                          <span className="ml-2 inline-flex items-center rounded bg-[#fef3c7] px-1.5 py-0.5 text-[10px] font-medium text-[#b45309]">
                            +{sub.graceMarksApplied} Grace Marks
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center text-[#475569]">{sub.credits}</td>
                      <td className="px-2 py-3 text-center text-[#94a3b8]">{sub.maxMarks}</td>
                      <td className="px-2 py-3 text-center font-bold text-[#0f172a]">
                        {sub.marksObtained}
                        {sub.graceMarksApplied && <span className="text-[#d97706]">*</span>}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <span
                          className={`inline-block min-w-8 rounded-full border px-2 py-0.5 text-center font-black ${
                            gradeBadgeColors[sub.grade] ?? 'bg-[#f1f5f9] text-[#475569]'
                          }`}
                        >
                          {sub.grade}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-center font-bold text-[#334155]">{sub.gradePoints}</td>
                      <td className="py-3 pl-2 pr-4 text-right">
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

          {/* RuleCraft AI Policy & Regulation Verdict Banner */}
          <div
            className={`rounded-xl border p-4 ${
              data.regulationVerdict.outcome === 'detained'
                ? 'border-[#fecaca] bg-[#fef2f2]'
                : data.regulationVerdict.outcome === 'promoted_with_atkt'
                  ? 'border-[#fef08a] bg-[#fefce8]'
                  : 'border-[#bbf7d0] bg-[#f0fdf4]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 rounded-lg p-2 ${
                  data.regulationVerdict.outcome === 'detained'
                    ? 'bg-[#fee2e2] text-[#dc2626]'
                    : 'bg-[#dcfce7] text-[#16a34a]'
                }`}
              >
                <ShieldCheck size={20} />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                    RuleCraft AI Decision ({data.regulationVerdict.regulationCode})
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wide ${
                      data.regulationVerdict.outcome === 'detained'
                        ? 'bg-[#dc2626] text-white'
                        : data.regulationVerdict.outcome === 'promoted_with_atkt'
                          ? 'bg-[#d97706] text-white'
                          : 'bg-[#16a34a] text-white'
                    }`}
                  >
                    {data.regulationVerdict.outcome.replace(/_/g, ' ')}
                  </span>
                </div>
                <h4
                  className={`mt-1 text-sm font-black ${
                    data.regulationVerdict.outcome === 'detained'
                      ? 'text-[#991b1b]'
                      : data.regulationVerdict.outcome === 'promoted_with_atkt'
                        ? 'text-[#854d0e]'
                        : 'text-[#14532d]'
                  }`}
                >
                  {data.regulationVerdict.outcomeLabel}
                </h4>
                <p className="mt-1 text-xs text-[#475569]">
                  Evaluated under policy: <span className="font-semibold text-[#0f172a]">{data.regulationVerdict.regulationName}</span>
                </p>

                {/* Specific Rule Checks */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.regulationVerdict.ruleEvaluations.map((rule, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 rounded-md border border-black/5 bg-white/70 px-2.5 py-1 text-[11px]"
                    >
                      {rule.passed ? (
                        <CheckCircle2 size={13} className="text-[#16a34a]" />
                      ) : (
                        <XCircle size={13} className="text-[#dc2626]" />
                      )}
                      <span className="font-semibold text-[#334155]">{rule.ruleName}:</span>
                      <span className="text-[#64748b]">{rule.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Toolbar & QR Verification */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e8f0] pt-4 print:hidden">
            <div className="flex items-center gap-2.5">
              {data.verification?.qrCodeDataUrl && (
                <img
                  src={data.verification.qrCodeDataUrl}
                  alt="QR Verification"
                  className="h-11 w-11 rounded border border-[#cbd5e1] bg-white p-0.5 shadow-2xs"
                />
              )}
              <div>
                <p className="text-[11px] font-bold text-[#0f172a]">Digitally Verified Record</p>
                <a
                  href={`/verify/${data.verification?.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold text-[#4338ca] hover:underline"
                >
                  Open Public Verification Page &rarr;
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3.5 py-2 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc]"
              >
                <Printer size={14} /> Print
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="flex items-center gap-1.5 rounded-lg bg-[#4338ca] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#3730a3] disabled:opacity-70"
              >
                {isDownloadingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Download Official PDF
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
