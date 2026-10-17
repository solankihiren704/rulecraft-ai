import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Award,
  CheckCircle2,
  Download,
  Loader2,
  Printer,
  ShieldCheck,
  XCircle,
  ExternalLink,
  Calendar,
  Building2,
  GraduationCap,
} from 'lucide-react'
import { triggerBlobDownload } from '@/utils/download'
import * as studentsApi from '@/api/students'
import type { PublicVerificationResponse } from '@/api/students'

const gradeBadgeColors: Record<string, string> = {
  O: 'bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]',
  'A+': 'bg-[#e0e7ff] text-[#4338ca] border-[#c7d2fe]',
  A: 'bg-[#ede9fe] text-[#6d28d9] border-[#ddd6fe]',
  'B+': 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]',
  B: 'bg-[#f0fdf4] text-[#166534] border-[#dcfce7]',
  C: 'bg-[#fef9c3] text-[#854d0e] border-[#fef08a]',
  F: 'bg-[#fee2e2] text-[#b91c1c] border-[#fecaca]',
}

export default function PublicVerifyPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PublicVerificationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Verification token is missing.')
      setLoading(false)
      return
    }

    let isMounted = true
    async function verifyRecord() {
      setLoading(true)
      setError('')
      try {
        const res = await studentsApi.getPublicVerification(token!)
        if (isMounted) setData(res)
      } catch {
        if (isMounted) {
          setError('This academic credential is unverified, altered, or does not exist in the university registry.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    verifyRecord()
    return () => {
      isMounted = false
    }
  }, [token])

  async function handleDownloadPdf() {
    if (!token) return
    setIsDownloadingPdf(true)
    try {
      const { blob, filename } = await studentsApi.downloadPublicVerificationPdf(token)
      triggerBlobDownload(blob, filename)
    } catch {
      alert('Failed to download verified PDF.')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] antialiased">
      {/* Top Banner */}
      <header className="border-b border-[#e2e8f0] bg-white shadow-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4338ca] text-white shadow-xs">
              <Award size={22} />
            </div>
            <div>
              <p className="font-display text-sm font-extrabold tracking-tight text-[#0f172a]">NORTHBRIDGE UNIVERSITY</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">
                Public Credential Verification Portal
              </p>
            </div>
          </div>

          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] px-3 py-1.5 text-xs font-semibold text-[#334155] transition-colors hover:bg-[#f1f5f9]"
          >
            <span>University Login</span>
            <ExternalLink size={13} />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="animate-spin text-[#4338ca]" size={40} />
            <p className="text-sm font-bold text-[#334155]">Verifying academic credential signature...</p>
            <p className="text-xs text-[#64748b]">Cryptographically matching cryptographic hash against central ledger</p>
          </div>
        ) : error ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-[#fecaca] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#fee2e2] text-[#dc2626]">
              <XCircle size={32} />
            </div>
            <h2 className="text-lg font-extrabold text-[#0f172a]">Verification Failed</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#64748b]">{error}</p>
            <p className="mt-4 text-xs text-[#94a3b8]">
              Token: <span className="font-mono">{token}</span>
            </p>
            <div className="mt-6">
              <Link
                to="/"
                className="inline-flex items-center rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b]"
              >
                Return to Homepage
              </Link>
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Authenticity Verification Hero Badge */}
            <div className="rounded-2xl border-2 border-[#16a34a] bg-[#f0fdf4] p-5 shadow-sm sm:p-6">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-white shadow-xs">
                    <ShieldCheck size={28} />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-[#15803d]">
                      <CheckCircle2 size={13} />
                      Authentic University Credential
                    </div>
                    <h1 className="mt-1 font-display text-xl font-extrabold text-[#0f172a]">
                      Verified Official Grade Report & Marksheet
                    </h1>
                    <p className="text-xs font-medium text-[#475569]">
                      Issued by {data.issuingOffice}, {data.institution}
                    </p>
                  </div>
                </div>

                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <button
                    onClick={() => window.print()}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2 text-xs font-bold text-[#334155] shadow-xs hover:bg-[#f8fafc] sm:flex-initial"
                  >
                    <Printer size={15} />
                    <span>Print</span>
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    disabled={isDownloadingPdf}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#4338ca] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#3730a3] sm:flex-initial"
                  >
                    {isDownloadingPdf ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    <span>Download Official PDF</span>
                  </button>
                </div>
              </div>

              {/* Verification Metadata Strip */}
              <div className="mt-4 flex flex-wrap items-center gap-y-2 divide-x divide-[#bbf7d0] border-t border-[#bbf7d0] pt-3 text-[11px] text-[#166534]">
                <div className="pr-3">
                  <span className="font-semibold text-[#15803d]">Certificate No:</span>{' '}
                  <span className="font-mono font-bold">{data.certificateNo}</span>
                </div>
                <div className="px-3">
                  <span className="font-semibold text-[#15803d]">Verified On:</span>{' '}
                  <span>{new Date(data.verifiedAt).toLocaleString()}</span>
                </div>
                <div className="px-3">
                  <span className="font-semibold text-[#15803d]">Digital Signature:</span>{' '}
                  <span className="font-mono">VALID (SHA-256 HMAC)</span>
                </div>
              </div>
            </div>

            {/* Official Marksheet Card */}
            <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-xs sm:p-8">
              {/* University Seal Header */}
              <div className="border-b border-[#e2e8f0] pb-6 text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4338ca]">
                  <Award size={28} />
                </div>
                <h2 className="font-display text-2xl font-black tracking-tight text-[#0f172a]">
                  NORTHBRIDGE UNIVERSITY
                </h2>
                <p className="mt-0.5 text-xs font-bold uppercase tracking-widest text-[#64748b]">
                  {data.issuingOffice}
                </p>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#c7d2fe] bg-[#eef2ff] px-3 py-0.5 text-[11px] font-black text-[#4338ca]">
                  OFFICIAL SEMESTER GRADE CARD
                </div>
              </div>

              {/* Student Details Grid */}
              <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-xs sm:grid-cols-4">
                <div>
                  <p className="flex items-center gap-1 text-[#94a3b8]">
                    <GraduationCap size={13} />
                    <span>Candidate Name</span>
                  </p>
                  <p className="mt-0.5 font-bold text-[#0f172a]">{data.student.name}</p>
                </div>
                <div>
                  <p className="text-[#94a3b8]">Roll No. / Student ID</p>
                  <p className="mt-0.5 font-mono font-bold text-[#4338ca]">{data.student.studentId}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-[#94a3b8]">
                    <Building2 size={13} />
                    <span>Department & Program</span>
                  </p>
                  <p className="mt-0.5 font-semibold text-[#0f172a]">
                    {data.student.departmentName} ({data.student.programCode})
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-[#94a3b8]">
                    <Calendar size={13} />
                    <span>Semester / Year</span>
                  </p>
                  <p className="mt-0.5 font-semibold text-[#0f172a]">
                    {data.student.semesterName} (Year {data.student.year})
                  </p>
                </div>
              </div>

              {/* Academic Highlights Cards */}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-xl border border-[#e2e8f0] bg-white p-3.5 text-center shadow-xs">
                  <p className="text-xs font-medium text-[#64748b]">Total Marks</p>
                  <p className="mt-1 font-display text-xl font-black text-[#0f172a]">
                    {data.academicSummary.totalMarksObtained}{' '}
                    <span className="text-xs font-normal text-[#94a3b8]">/ {data.academicSummary.maxTotalMarks}</span>
                  </p>
                </div>
                <div className="rounded-xl border border-[#e2e8f0] bg-white p-3.5 text-center shadow-xs">
                  <p className="text-xs font-medium text-[#64748b]">Percentage</p>
                  <p className="mt-1 font-display text-xl font-black text-[#0f172a]">{data.academicSummary.percentage}%</p>
                </div>
                <div className="rounded-xl border border-[#c7d2fe] bg-[#eef2ff] p-3.5 text-center shadow-xs">
                  <p className="text-xs font-bold text-[#4338ca]">Semester SGPA</p>
                  <p className="mt-1 font-display text-xl font-black text-[#4338ca]">{data.academicSummary.sgpa.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-[#c7d2fe] bg-[#eef2ff] p-3.5 text-center shadow-xs">
                  <p className="text-xs font-bold text-[#4338ca]">Cumulative CGPA</p>
                  <p className="mt-1 font-display text-xl font-black text-[#4338ca]">{data.academicSummary.cgpa.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-3.5 text-center shadow-xs">
                  <p className="text-xs font-bold text-[#166534]">Earned Credits</p>
                  <p className="mt-1 font-display text-xl font-black text-[#166534]">
                    {data.academicSummary.creditsEarned} / {data.academicSummary.totalCredits}
                  </p>
                </div>
              </div>

              {/* Subject Breakdown Table */}
              <div className="mt-6 overflow-hidden rounded-xl border border-[#e2e8f0]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[11px] font-bold text-[#475569]">
                      <th className="py-3 pl-4 pr-2">Subject Code</th>
                      <th className="px-3 py-3">Subject Title</th>
                      <th className="px-2 py-3 text-center">Credits</th>
                      <th className="px-2 py-3 text-center">Max</th>
                      <th className="px-2 py-3 text-center">Marks Obtained</th>
                      <th className="px-2 py-3 text-center">Letter Grade</th>
                      <th className="px-2 py-3 text-center">Grade Points</th>
                      <th className="py-3 pl-2 pr-4 text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {data.subjects.map((sub) => (
                      <tr key={sub.code} className="hover:bg-[#f8fafc]">
                        <td className="py-3 pl-4 pr-2 font-mono font-bold text-[#0f172a]">{sub.code}</td>
                        <td className="px-3 py-3 font-semibold text-[#1e293b]">
                          {sub.name}
                          {sub.graceMarksApplied && (
                            <span className="ml-2 inline-flex items-center rounded bg-[#fef3c7] px-1.5 py-0.5 text-[10px] font-bold text-[#b45309]">
                              +{sub.graceMarksApplied} Grace Marks
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-3 text-center text-[#475569]">{sub.credits}</td>
                        <td className="px-2 py-3 text-center text-[#94a3b8]">{sub.maxMarks}</td>
                        <td className="px-2 py-3 text-center font-bold text-[#0f172a]">{sub.marksObtained}</td>
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
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                              sub.status === 'failed'
                                ? 'bg-[#fee2e2] text-[#dc2626]'
                                : sub.status === 'passed_with_grace'
                                  ? 'bg-[#fef3c7] text-[#b45309]'
                                  : 'bg-[#dcfce7] text-[#16a34a]'
                            }`}
                          >
                            {sub.status === 'failed' ? 'Failed' : sub.status === 'passed_with_grace' ? 'Passed*' : 'Passed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Regulation Verdict Banner */}
              <div
                className={`mt-6 rounded-xl border p-4 ${
                  data.regulationVerdict.outcome === 'detained'
                    ? 'border-[#fecaca] bg-[#fef2f2]'
                    : data.regulationVerdict.outcome === 'promoted_with_atkt'
                      ? 'border-[#fef08a] bg-[#fefce8]'
                      : 'border-[#bbf7d0] bg-[#f0fdf4]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    size={20}
                    className={data.regulationVerdict.outcome === 'detained' ? 'text-[#dc2626]' : 'text-[#16a34a]'}
                  />
                  <h3
                    className={`text-xs font-black uppercase tracking-wider ${
                      data.regulationVerdict.outcome === 'detained' ? 'text-[#991b1b]' : 'text-[#166534]'
                    }`}
                  >
                    University Regulation Decision ({data.regulationVerdict.regulationCode})
                  </h3>
                </div>
                <p className="mt-1 font-display text-sm font-extrabold text-[#0f172a]">
                  {data.regulationVerdict.outcomeLabel}
                </p>
                <p className="mt-0.5 text-xs text-[#475569]">
                  Governing Regulation: {data.regulationVerdict.regulationName}
                </p>
              </div>

              {/* Controller Footer */}
              <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-[#e2e8f0] pt-6 sm:flex-row">
                <div className="text-center sm:text-left">
                  <p className="text-xs font-bold text-[#0f172a]">Office of the Controller of Examinations</p>
                  <p className="text-[11px] text-[#64748b]">Northbridge University • Central Academic Registry</p>
                </div>
                <div className="text-center sm:text-right">
                  <p className="text-[11px] font-semibold text-[#16a34a]">✓ Digitally Signed & Sealed</p>
                  <p className="font-mono text-[10px] text-[#94a3b8]">Verified Reference: {data.token.slice(0, 24)}...</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
