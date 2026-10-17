import { useState, useMemo } from 'react'
import {
  Calculator,
  RotateCcw,
  Plus,
  Trash2,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import type { StudentResultData } from '@/api/students'

interface TargetCalculatorProps {
  initialData: StudentResultData
}

interface SimulatedSubject {
  id: string
  code: string
  name: string
  credits: number
  marks: number
  isCustom?: boolean
}

function calculateGrade(marks: number): { grade: string; points: number } {
  if (marks >= 90) return { grade: 'O', points: 10 }
  if (marks >= 80) return { grade: 'A+', points: 9 }
  if (marks >= 70) return { grade: 'A', points: 8 }
  if (marks >= 60) return { grade: 'B+', points: 7 }
  if (marks >= 50) return { grade: 'B', points: 6 }
  if (marks >= 40) return { grade: 'C', points: 5 }
  return { grade: 'F', points: 0 }
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

export default function TargetCalculator({ initialData }: TargetCalculatorProps) {
  const [targetCgpa, setTargetCgpa] = useState<number>(8.5)

  // Initialize simulated subjects from actual subjects
  const [simulatedSubjects, setSimulatedSubjects] = useState<SimulatedSubject[]>(() =>
    initialData.subjects.map((s) => ({
      id: s.code,
      code: s.code,
      name: s.name,
      credits: s.credits,
      marks: s.marksObtained,
    })),
  )

  const [newSubjectTitle, setNewSubjectTitle] = useState('')
  const [newSubjectCredits, setNewSubjectCredits] = useState(4)

  // Recalculate metrics in real-time
  const calculation = useMemo(() => {
    let totalCredits = 0
    let totalWeightedPoints = 0
    let totalMarks = 0
    let totalMaxMarks = 0

    simulatedSubjects.forEach((sub) => {
      const { points } = calculateGrade(sub.marks)
      totalCredits += sub.credits
      totalWeightedPoints += points * sub.credits
      totalMarks += sub.marks
      totalMaxMarks += 100
    })

    const projectedSgpa = totalCredits > 0 ? totalWeightedPoints / totalCredits : 0
    const percentage = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0

    // Approximate cumulative CGPA blending past semesters
    const actualCgpa = initialData.academicSummary.cgpa
    const projectedCgpa = Number(((actualCgpa * 0.6) + (projectedSgpa * 0.4)).toFixed(2))

    const deltaCgpa = Number((projectedCgpa - actualCgpa).toFixed(2))
    const gapToTarget = Number((targetCgpa - projectedCgpa).toFixed(2))
    const isTargetMet = projectedCgpa >= targetCgpa

    return {
      projectedSgpa: Number(projectedSgpa.toFixed(2)),
      projectedCgpa,
      percentage: Number(percentage.toFixed(1)),
      totalMarks,
      totalMaxMarks,
      totalCredits,
      deltaCgpa,
      gapToTarget,
      isTargetMet,
    }
  }, [simulatedSubjects, initialData.academicSummary.cgpa, targetCgpa])

  function handleMarkChange(id: string, newMark: number) {
    const clamped = Math.min(100, Math.max(0, newMark))
    setSimulatedSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, marks: clamped } : s)))
  }

  function handleAddSubject(e: React.FormEvent) {
    e.preventDefault()
    if (!newSubjectTitle.trim()) return

    const newSub: SimulatedSubject = {
      id: `sim-${Date.now()}`,
      code: `ELEC${simulatedSubjects.length + 1}`,
      name: newSubjectTitle.trim(),
      credits: Number(newSubjectCredits) || 3,
      marks: 80,
      isCustom: true,
    }

    setSimulatedSubjects((prev) => [...prev, newSub])
    setNewSubjectTitle('')
  }

  function handleRemoveSubject(id: string) {
    setSimulatedSubjects((prev) => prev.filter((s) => s.id !== id))
  }

  function handleReset() {
    setSimulatedSubjects(
      initialData.subjects.map((s) => ({
        id: s.code,
        code: s.code,
        name: s.name,
        credits: s.credits,
        marks: s.marksObtained,
      })),
    )
    setTargetCgpa(8.5)
  }

  return (
    <div className="space-y-6">
      {/* Target Planning Header Banner */}
      <div className="rounded-2xl border border-[#c7d2fe] bg-linear-to-r from-[#eef2ff] via-[#f0fdf4] to-[#f8fafc] p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#4338ca] text-white shadow-xs">
              <Calculator size={22} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#c7d2fe]/60 px-2.5 py-0.5 text-[11px] font-black uppercase text-[#3730a3]">
                <Sparkles size={12} />
                RuleCraft What-If Simulator
              </div>
              <h2 className="mt-0.5 font-display text-lg font-black text-[#0f172a]">
                Target CGPA & Exam Score Planner
              </h2>
              <p className="text-xs text-[#475569]">
                Adjust sliders to project how different exam scores will impact your SGPA, CGPA, and degree classification.
              </p>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2 text-xs font-bold text-[#475569] shadow-xs hover:bg-[#f8fafc]"
          >
            <RotateCcw size={14} />
            <span>Reset to Actual</span>
          </button>
        </div>

        {/* Target Setter Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#e2e8f0]/80 pt-4">
          <span className="text-xs font-bold text-[#334155]">Set Target CGPA:</span>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: '8.50 (Distinction)', value: 8.5 },
              { label: '7.50 (First Class)', value: 7.5 },
              { label: '9.00 (Excellence)', value: 9.0 },
              { label: '9.50 (Gold Medal)', value: 9.5 },
            ].map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setTargetCgpa(preset.value)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  targetCgpa === preset.value
                    ? 'bg-[#4338ca] text-white shadow-xs'
                    : 'border border-[#cbd5e1] bg-white text-[#475569] hover:bg-[#f1f5f9]'
                }`}
              >
                {preset.label}
              </button>
            ))}
            <div className="flex items-center gap-1.5 pl-2">
              <span className="text-xs text-[#64748b]">Custom:</span>
              <input
                type="number"
                step="0.05"
                min="4"
                max="10"
                value={targetCgpa}
                onChange={(e) => setTargetCgpa(Number(e.target.value))}
                className="w-16 rounded-md border border-[#cbd5e1] bg-white px-2 py-1 text-center text-xs font-bold text-[#0f172a] shadow-xs focus:border-[#4338ca] focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Projected Scorecards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold text-[#64748b]">Projected SGPA</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="font-display text-2xl font-black text-[#4338ca]">{calculation.projectedSgpa.toFixed(2)}</p>
            <span className="text-xs font-semibold text-[#94a3b8]">
              (Actual: {initialData.academicSummary.sgpa.toFixed(2)})
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[#c7d2fe] bg-[#eef2ff]/50 p-4 shadow-xs">
          <p className="text-xs font-bold text-[#3730a3]">Projected Cumulative CGPA</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="font-display text-2xl font-black text-[#3730a3]">{calculation.projectedCgpa.toFixed(2)}</p>
            {calculation.deltaCgpa !== 0 && (
              <span
                className={`inline-flex items-center text-xs font-bold ${
                  calculation.deltaCgpa > 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'
                }`}
              >
                <TrendingUp size={13} className={calculation.deltaCgpa < 0 ? 'rotate-180' : ''} />
                {calculation.deltaCgpa > 0 ? `+${calculation.deltaCgpa}` : calculation.deltaCgpa}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold text-[#64748b]">Projected Marks</p>
          <p className="mt-1 font-display text-2xl font-black text-[#0f172a]">
            {calculation.totalMarks}{' '}
            <span className="text-xs font-normal text-[#94a3b8]">/ {calculation.totalMaxMarks}</span>
          </p>
        </div>

        <div
          className={`rounded-xl border p-4 shadow-xs ${
            calculation.isTargetMet
              ? 'border-[#bbf7d0] bg-[#f0fdf4]'
              : 'border-[#fef08a] bg-[#fefce8]'
          }`}
        >
          <div className="flex items-center justify-between">
            <p
              className={`text-xs font-bold ${
                calculation.isTargetMet ? 'text-[#166534]' : 'text-[#854d0e]'
              }`}
            >
              Goal Status
            </p>
            {calculation.isTargetMet ? (
              <CheckCircle2 size={16} className="text-[#16a34a]" />
            ) : (
              <AlertCircle size={16} className="text-[#ca8a04]" />
            )}
          </div>
          <p
            className={`mt-1 font-display text-lg font-black ${
              calculation.isTargetMet ? 'text-[#15803d]' : 'text-[#a16207]'
            }`}
          >
            {calculation.isTargetMet ? 'TARGET ACHIEVED' : `GAP: ${calculation.gapToTarget} CGPA`}
          </p>
          <p className="text-[11px] text-[#64748b]">
            {calculation.isTargetMet
              ? `Exceeds target of ${targetCgpa.toFixed(2)} by +${Math.abs(calculation.gapToTarget).toFixed(2)}`
              : `Needs approx. +${Math.round(calculation.gapToTarget * 20)} marks to reach ${targetCgpa.toFixed(2)}`}
          </p>
        </div>
      </div>

      {/* Interactive Subject Adjuster Table */}
      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-xs">
        <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-5 py-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#334155]">
                Subject Exam Scores Simulator
              </h3>
              <p className="text-[11px] text-[#64748b]">
                Drag the sliders or enter marks to test different exam outcomes.
              </p>
            </div>
            <span className="rounded-md bg-[#e2e8f0] px-2 py-0.5 text-xs font-semibold text-[#475569]">
              {simulatedSubjects.length} subjects
            </span>
          </div>
        </div>

        <div className="divide-y divide-[#f1f5f9]">
          {simulatedSubjects.map((sub) => {
            const gradeInfo = calculateGrade(sub.marks)
            return (
              <div key={sub.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-[#fafafa] sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-56">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#4338ca]">{sub.code}</span>
                    <span className="rounded bg-[#f1f5f9] px-1.5 py-0.2 text-[10px] font-semibold text-[#475569]">
                      {sub.credits} Credits
                    </span>
                    {sub.isCustom && (
                      <span className="rounded bg-[#fef3c7] px-1.5 py-0.2 text-[10px] font-bold text-[#b45309]">
                        Simulated
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-[#0f172a]">{sub.name}</p>
                </div>

                {/* Interactive Slider and Marks */}
                <div className="flex flex-1 items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sub.marks}
                    onChange={(e) => handleMarkChange(sub.id, Number(e.target.value))}
                    className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-[#e2e8f0] accent-[#4338ca]"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMarkChange(sub.id, sub.marks - 5)}
                      className="rounded border border-[#cbd5e1] bg-white px-1.5 py-0.5 text-[11px] font-bold hover:bg-[#f1f5f9]"
                    >
                      -5
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={sub.marks}
                      onChange={(e) => handleMarkChange(sub.id, Number(e.target.value))}
                      className="w-14 rounded-md border border-[#cbd5e1] bg-white px-1.5 py-1 text-center text-xs font-black text-[#0f172a] shadow-2xs focus:border-[#4338ca] focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => handleMarkChange(sub.id, sub.marks + 5)}
                      className="rounded border border-[#cbd5e1] bg-white px-1.5 py-0.5 text-[11px] font-bold hover:bg-[#f1f5f9]"
                    >
                      +5
                    </button>
                  </div>
                </div>

                {/* Live Grade Preview */}
                <div className="flex items-center justify-end gap-3 min-w-32">
                  <div className="text-right">
                    <span
                      className={`inline-block min-w-8 rounded-full border px-2 py-0.5 text-center text-xs font-black ${
                        gradeBadgeColors[gradeInfo.grade] ?? 'bg-[#f1f5f9] text-[#475569]'
                      }`}
                    >
                      {gradeInfo.grade}
                    </span>
                    <p className="text-[10px] text-[#64748b]">{gradeInfo.points} Grade Points</p>
                  </div>

                  {sub.isCustom && (
                    <button
                      onClick={() => handleRemoveSubject(sub.id)}
                      className="rounded p-1 text-[#94a3b8] hover:bg-[#fee2e2] hover:text-[#dc2626]"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Add Upcoming/Simulated Subject Form */}
        <form onSubmit={handleAddSubject} className="flex flex-wrap items-center gap-3 border-t border-[#e2e8f0] bg-[#f8fafc] p-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#475569]">
            <Plus size={15} className="text-[#4338ca]" />
            <span>Simulate Upcoming Course:</span>
          </div>
          <input
            type="text"
            placeholder="e.g. Advanced Cloud Computing / Final Project"
            value={newSubjectTitle}
            onChange={(e) => setNewSubjectTitle(e.target.value)}
            className="min-w-64 flex-1 rounded-lg border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs text-[#0f172a] placeholder-[#94a3b8] shadow-2xs focus:border-[#4338ca] focus:outline-hidden"
          />
          <div className="flex items-center gap-1">
            <span className="text-xs text-[#64748b]">Credits:</span>
            <input
              type="number"
              min="1"
              max="10"
              value={newSubjectCredits}
              onChange={(e) => setNewSubjectCredits(Number(e.target.value))}
              className="w-14 rounded-lg border border-[#cbd5e1] bg-white px-2 py-1.5 text-center text-xs font-bold shadow-2xs"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-[#4338ca] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#3730a3]"
          >
            Add Course
          </button>
        </form>
      </div>

      {/* Helpful Academic Policy Guidance */}
      <div className="flex items-start gap-2.5 rounded-xl border border-[#bae6fd] bg-[#f0f9ff] p-4 text-xs text-[#0369a1]">
        <HelpCircle size={18} className="shrink-0 text-[#0284c7]" />
        <p className="leading-relaxed">
          <span className="font-bold">Grading Scheme:</span> O (90-100%, 10 pts) • A+ (80-89%, 9 pts) • A (70-79%, 8 pts) • B+ (60-69%, 7 pts) • B (50-59%, 6 pts) • C (40-49%, 5 pts) • F (&lt;40%, 0 pts). Calculations follow Northbridge University credit-weighted GPA regulations.
        </p>
      </div>
    </div>
  )
}
