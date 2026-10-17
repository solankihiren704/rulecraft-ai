import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Trophy,
  Award,
  Medal,
  Download,
  Search,
  Sparkles,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import {
  getUniversityRanks,
  exportRanksCsv,
  type RankListResponse,
} from '@/api/ranks'
import { triggerBlobDownload } from '@/utils/download'
import { ApiRequestError } from '@/api/client'

export default function RankListPage() {
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [downloadingCsv, setDownloadingCsv] = useState(false)
  const [data, setData] = useState<RankListResponse | null>(null)

  const [selectedProgramId, setSelectedProgramId] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'deans_list' | 'probation'>('all')

  async function loadRanks() {
    setLoading(true)
    try {
      const res = await getUniversityRanks({
        programId: selectedProgramId || undefined,
        year: selectedYear || undefined,
        search: searchQuery || undefined,
        filterType: activeTab,
      })
      setData(res)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to load rankings.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRanks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId, selectedYear, activeTab])

  async function handleExport() {
    setDownloadingCsv(true)
    try {
      const { blob, filename } = await exportRanksCsv({
        programId: selectedProgramId || undefined,
        year: selectedYear || undefined,
      })
      triggerBlobDownload(blob, filename)
      showToast('Official university rank list CSV downloaded.', 'success')
    } catch (err) {
      showToast('Failed to export rank list.', 'error')
    } finally {
      setDownloadingCsv(false)
    }
  }

  const topThree = data?.stats.topThree || []

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b0f19] via-[#1a2333] to-[#0b0f19] p-6 text-white shadow-2xl sm:p-8">
        <div className="absolute right-0 top-0 -mr-20 -mt-20 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute left-1/3 bottom-0 -mb-20 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
              <Trophy size={13} className="text-amber-400" />
              Academic Excellence & Honors Board
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              University Rank List & Dean's Honor Roll
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Official percentile rankings, Gold / Silver / Bronze podium toppers, Top 5% Dean's Honor inductees, and academic performance monitoring.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              disabled={downloadingCsv || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition hover:brightness-110 disabled:opacity-50"
            >
              {downloadingCsv ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Export Rank List (CSV)
            </button>
          </div>
        </div>

        {/* Podium Top 3 Cards */}
        {topThree.length >= 3 && (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Rank 2 (Silver) */}
            <div className="order-2 sm:order-1 rounded-2xl border border-slate-700/60 bg-slate-800/40 p-4 backdrop-blur-md transition hover:border-slate-500/50">
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-300/20 text-slate-200 font-display font-bold text-sm">
                  #2
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/30 bg-slate-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-200">
                  <Medal size={12} className="text-slate-300" /> Silver Medalist
                </span>
              </div>
              <div className="mt-4">
                <p className="font-display text-lg font-bold text-white truncate">{topThree[1].name}</p>
                <p className="font-mono text-xs text-slate-400">{topThree[1].studentId} • {topThree[1].programName}</p>
                <div className="mt-3 flex items-baseline justify-between border-t border-slate-700/50 pt-2">
                  <span className="text-xs text-slate-400">Cumulative GPA</span>
                  <span className="font-display text-xl font-bold text-slate-100">{topThree[1].cgpa.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Rank 1 (Gold) */}
            <div className="order-1 sm:order-2 rounded-2xl border-2 border-amber-400/50 bg-gradient-to-b from-amber-500/15 via-slate-800/60 to-slate-800/40 p-5 shadow-lg shadow-amber-500/10 backdrop-blur-md transition hover:border-amber-400">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-slate-900 font-display font-black text-base shadow-md shadow-amber-400/40">
                  #1
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                  <Trophy size={13} className="text-amber-300" /> Gold Medalist
                </span>
              </div>
              <div className="mt-4">
                <p className="font-display text-xl font-extrabold text-amber-100 truncate">{topThree[0].name}</p>
                <p className="font-mono text-xs text-amber-200/70">{topThree[0].studentId} • {topThree[0].programName}</p>
                <div className="mt-3 flex items-baseline justify-between border-t border-amber-400/20 pt-2">
                  <span className="text-xs text-amber-200/80 font-medium">University Valedictorian</span>
                  <span className="font-display text-2xl font-black text-amber-300">{topThree[0].cgpa.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Rank 3 (Bronze) */}
            <div className="order-3 rounded-2xl border border-amber-700/50 bg-slate-800/40 p-4 backdrop-blur-md transition hover:border-amber-600/50">
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-700/30 text-amber-300 font-display font-bold text-sm">
                  #3
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-600/30 bg-amber-600/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                  <Medal size={12} className="text-amber-500" /> Bronze Medalist
                </span>
              </div>
              <div className="mt-4">
                <p className="font-display text-lg font-bold text-white truncate">{topThree[2].name}</p>
                <p className="font-mono text-xs text-slate-400">{topThree[2].studentId} • {topThree[2].programName}</p>
                <div className="mt-3 flex items-baseline justify-between border-t border-slate-700/50 pt-2">
                  <span className="text-xs text-slate-400">Cumulative GPA</span>
                  <span className="font-display text-xl font-bold text-amber-200">{topThree[2].cgpa.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Aggregate KPI Strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-6 sm:grid-cols-5">
          <div className="rounded-xl bg-white/5 p-3">
            <span className="text-xs text-slate-400">Evaluated Candidates</span>
            <p className="font-display text-xl font-bold text-white">{data?.stats.totalEvaluated ?? 0}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <span className="text-xs text-slate-400">Class Median CGPA</span>
            <p className="font-display text-xl font-bold text-emerald-300">{data?.stats.medianCgpa.toFixed(2) ?? '0.00'}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <span className="text-xs text-slate-400">University Pass Rate</span>
            <p className="font-display text-xl font-bold text-indigo-300">{data?.stats.passPercentage ?? 0}%</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <span className="text-xs text-slate-400">Dean's Honor Roll</span>
            <p className="font-display text-xl font-bold text-amber-300">{data?.stats.deansListCount ?? 0} Inductees</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <span className="text-xs text-slate-400">Probation Watchlist</span>
            <p className="font-display text-xl font-bold text-rose-300">{data?.stats.probationCount ?? 0} Students</p>
          </div>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Rankings ({data?.stats.totalEvaluated ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('deans_list')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'deans_list'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            <Sparkles size={13} />
            Dean's Honor Roll ({data?.stats.deansListCount ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('probation')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'probation'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle size={13} />
            Probation Watchlist ({data?.stats.probationCount ?? 0})
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Program Select */}
          <select
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Academic Programs</option>
            {data?.programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>

          {/* Year Select */}
          <select
            value={selectedYear || ''}
            onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Years</option>
            <option value="1">Year 1</option>
            <option value="2">Year 2</option>
            <option value="3">Year 3</option>
            <option value="4">Year 4</option>
          </select>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
        <input
          type="text"
          placeholder="Search by student name or roll number (e.g. STU-001)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {/* Leaderboard Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-amber-500" size={32} />
            <p className="text-xs font-medium text-slate-500">Calculating percentiles and standings...</p>
          </div>
        ) : !data || data.students.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <Award className="text-slate-300" size={36} />
            <p className="mt-2 text-sm font-semibold text-slate-700">No students match current filters</p>
            <p className="text-xs text-slate-500">Try changing program, year, or tab view.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 pl-6 pr-3 text-center">Rank</th>
                  <th className="px-4 py-3.5">Student</th>
                  <th className="px-4 py-3.5">Department & Program</th>
                  <th className="px-4 py-3.5 text-center">Year</th>
                  <th className="px-4 py-3.5 text-center">CGPA</th>
                  <th className="px-4 py-3.5 text-center">SGPA</th>
                  <th className="px-4 py-3.5 text-center">Percentage</th>
                  <th className="px-4 py-3.5 text-center">Percentile</th>
                  <th className="px-4 py-3.5 text-center">Honors / Standing</th>
                  <th className="py-3.5 pl-2 pr-6 text-right">Marksheet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.students.map((stu) => {
                  return (
                    <tr key={stu.dbId} className="transition hover:bg-slate-50/70">
                      {/* Rank badge */}
                      <td className="py-3.5 pl-6 pr-3 text-center">
                        {stu.medal === 'gold' ? (
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 font-display text-xs font-black text-slate-900 shadow-sm shadow-amber-400/50">
                            1
                          </span>
                        ) : stu.medal === 'silver' ? (
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-300 font-display text-xs font-bold text-slate-800">
                            2
                          </span>
                        ) : stu.medal === 'bronze' ? (
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-600 font-display text-xs font-bold text-white">
                            3
                          </span>
                        ) : (
                          <span className="font-mono text-xs font-semibold text-slate-500">
                            #{stu.rank}
                          </span>
                        )}
                      </td>

                      {/* Student info */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 font-display text-[10px] font-bold text-indigo-700">
                            {stu.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{stu.name}</p>
                            <p className="font-mono text-[10px] text-slate-500">{stu.studentId}</p>
                          </div>
                        </div>
                      </td>

                      {/* Department & Program */}
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-800">{stu.programName}</p>
                        <p className="text-[10px] text-slate-500">{stu.departmentName}</p>
                      </td>

                      {/* Year */}
                      <td className="px-4 py-3.5 text-center font-medium text-slate-700">
                        Year {stu.year}
                      </td>

                      {/* CGPA */}
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`font-mono text-xs font-bold ${
                            stu.cgpa >= 9.0
                              ? 'text-amber-600'
                              : stu.cgpa >= 7.5
                              ? 'text-indigo-600'
                              : stu.cgpa >= 5.0
                              ? 'text-slate-800'
                              : 'text-rose-600 font-extrabold'
                          }`}
                        >
                          {stu.cgpa.toFixed(2)}
                        </span>
                      </td>

                      {/* SGPA */}
                      <td className="px-4 py-3.5 text-center font-mono text-xs text-slate-600">
                        {stu.sgpa.toFixed(2)}
                      </td>

                      {/* Percentage */}
                      <td className="px-4 py-3.5 text-center font-mono text-xs text-slate-700">
                        {stu.percentage.toFixed(1)}%
                      </td>

                      {/* Percentile */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                          {stu.percentile.toFixed(1)}th
                        </span>
                      </td>

                      {/* Honors / Standing */}
                      <td className="px-4 py-3.5 text-center">
                        {stu.medal === 'gold' ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                            <Trophy size={11} className="text-amber-600" />
                            Gold Medalist
                          </span>
                        ) : stu.medal === 'silver' ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-800">
                            <Medal size={11} className="text-slate-600" />
                            Silver Medalist
                          </span>
                        ) : stu.medal === 'bronze' ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-600/30 bg-amber-100/60 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                            <Medal size={11} className="text-amber-700" />
                            Bronze Medalist
                          </span>
                        ) : stu.isDeansList ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold text-purple-700">
                            <Sparkles size={11} className="text-purple-600" />
                            Dean's List
                          </span>
                        ) : stu.isProbationWatch ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-semibold text-rose-700">
                            <AlertTriangle size={11} />
                            Probation ({stu.failedCount} backlog)
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-medium">Standard</span>
                        )}
                      </td>

                      {/* View Marksheet Link */}
                      <td className="py-3.5 pl-2 pr-6 text-right">
                        <Link
                          to={`/results?studentId=${stu.dbId}`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          View Result <ExternalLink size={11} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 p-4 text-xs text-slate-500">
          <span>Official University Registrar Merit Standings • Top 5% eligible for Dean's Commendation</span>
          <span>Showing {data?.students.length ?? 0} students</span>
        </div>
      </div>
    </div>
  )
}
