import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Download, FileBarChart, FileSpreadsheet, FileText, Loader2, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import EmptyState from '@/components/ui/EmptyState'
import FormField, { inputClassName } from '@/components/ui/FormField'
import * as reportsApi from '@/api/reports'
import * as regulationsApi from '@/api/regulations'
import * as programsApi from '@/api/programs'
import { ApiRequestError } from '@/api/client'
import type { RegulationWithRuleCount } from '@/api/regulations'
import type { Program, ReportSummary } from '@/types'

const reportTypes = [
  { id: 'eligibility-summary', label: 'Eligibility Summary' },
  { id: 'attendance-audit', label: 'Attendance Audit' },
  { id: 'promotion-outcomes', label: 'Promotion Outcomes' },
  { id: 'regulation-compliance', label: 'Regulation Compliance' },
] as const

const formatExtension: Record<ReportSummary['format'], string> = { csv: 'csv', pdf: 'pdf', excel: 'xlsx' }

const schema = z.object({
  reportType: z.enum(['eligibility-summary', 'attendance-audit', 'promotion-outcomes', 'regulation-compliance']),
  programId: z.string().min(1, 'Select a program.'),
  regulationId: z.string().min(1, 'Select a regulation.'),
  format: z.enum(['csv', 'pdf', 'excel']),
})

type FormValues = z.infer<typeof schema>
const formFields: (keyof FormValues)[] = ['reportType', 'programId', 'regulationId', 'format']

export default function ReportsPage() {
  const { showToast } = useToast()
  const [regulations, setRegulations] = useState<RegulationWithRuleCount[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [history, setHistory] = useState<ReportSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { reportType: 'eligibility-summary', programId: '', regulationId: '', format: 'csv' },
  })

  async function loadData() {
    setLoading(true)
    setLoadError('')
    try {
      const [regRows, progRows, historyRows] = await Promise.all([regulationsApi.list(), programsApi.list(), reportsApi.list()])
      setRegulations(regRows)
      setPrograms(progRows)
      setHistory(historyRows)
    } catch (err) {
      setLoadError(err instanceof ApiRequestError ? err.message : 'Failed to load reports.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function downloadReport(item: ReportSummary) {
    setDownloadingId(item.id)
    try {
      const { blob, filename } = await reportsApi.download(item.id, `${item.reportType}-${item.id}.${formatExtension[item.format]}`)
      reportsApi.triggerBlobDownload(blob, filename)
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to download report.', 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  async function onSubmit(values: FormValues) {
    setIsGenerating(true)
    try {
      const created = await reportsApi.generate(values)
      setHistory((prev) => [created, ...prev])
      showToast(`${reportTypes.find((t) => t.id === created.reportType)?.label} generated.`)
      await downloadReport(created)
    } catch (err) {
      if (err instanceof ApiRequestError && err.fieldErrors) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (formFields.includes(field as keyof FormValues)) {
            setError(field as keyof FormValues, { message })
          }
        }
      } else {
        showToast(err instanceof ApiRequestError ? err.message : 'Failed to generate report.', 'error')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  async function removeReport(item: ReportSummary) {
    try {
      await reportsApi.remove(item.id)
      setHistory((prev) => prev.filter((h) => h.id !== item.id))
      showToast('Report removed from history.')
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Failed to remove report.', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[#475569]" size={28} />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 pb-10 pt-8 sm:px-9 lg:px-12">
        <EmptyState icon={AlertCircle} title="Couldn't load reports" description={loadError} action={{ label: 'Retry', onClick: loadData }} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-10 pt-8 sm:px-9 lg:px-12">
      <div className="mb-8">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#4f46e5]">Insights</p>
        <h1 className="font-display text-[32px] font-bold tracking-[-0.04em] text-[#0f172a]">Reports</h1>
        <p className="mt-2 text-sm text-[#64748b]">Generate eligibility, attendance, and compliance reports for any program or regulation.</p>
      </div>

      <section className="border border-[#e2e8f0] bg-[#ffffff] p-5 sm:p-6">
        <h2 className="mb-4 font-display text-lg font-bold text-[#0f172a]">Generate a report</h2>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
          <FormField label="Report type" htmlFor="report-type" error={errors.reportType?.message} required>
            <select id="report-type" className={inputClassName} {...register('reportType')}>
              {reportTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Format" htmlFor="report-format" error={errors.format?.message} required>
            <select id="report-format" className={inputClassName} {...register('format')}>
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
            </select>
          </FormField>
          <FormField label="Program" htmlFor="report-program" error={errors.programId?.message} required>
            <select id="report-program" className={inputClassName} {...register('programId')}>
              <option value="">Select a program</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Regulation" htmlFor="report-regulation" error={errors.regulationId?.message} required>
            <select id="report-regulation" className={inputClassName} {...register('regulationId')}>
              <option value="">Select a regulation</option>
              {regulations.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </FormField>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isGenerating || regulations.length === 0 || programs.length === 0}
              className="flex items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#1e293b] disabled:cursor-wait disabled:opacity-70"
            >
              {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <FileBarChart size={15} />}
              {isGenerating ? 'Generating report...' : 'Generate report'}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 border border-[#e2e8f0] bg-[#ffffff] p-5 sm:p-6">
        <h2 className="mb-4 font-display text-lg font-bold text-[#0f172a]">Report history</h2>
        {history.length === 0 ? (
          <EmptyState icon={FileText} title="No reports generated yet" description="Generate your first report using the form above." />
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="flex items-center justify-between border border-[#e2e8f0] bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1f5f9] text-[#475569]">
                    {item.format === 'csv' ? <FileSpreadsheet size={16} /> : <FileText size={16} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0f172a]">{reportTypes.find((t) => t.id === item.reportType)?.label}</p>
                    <p className="text-xs text-[#94a3b8]">
                      {item.programName ?? 'Unknown program'} · {item.regulationName ?? 'Unknown regulation'} · {new Date(item.generatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadReport(item)}
                    disabled={downloadingId === item.id}
                    className="flex items-center gap-1.5 rounded border border-[#e2e8f0] px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-60"
                  >
                    {downloadingId === item.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download
                  </button>
                  <button onClick={() => removeReport(item)} className="rounded p-1.5 text-[#dc2626] hover:bg-[#fee2e2]" aria-label="Remove report">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
