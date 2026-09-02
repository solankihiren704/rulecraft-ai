import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpenCheck,
  Building2,
  FileBarChart,
  FlaskConical,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  Search,
  Users,
} from 'lucide-react'
import * as studentsApi from '@/api/students'
import * as regulationsApi from '@/api/regulations'
import * as programsApi from '@/api/programs'

interface CommandItem {
  id: string
  group: 'Pages' | 'Students' | 'Regulations'
  label: string
  detail?: string
  icon: typeof Search
  path: string
}

const pageCommands: CommandItem[] = [
  { id: 'page-dashboard', group: 'Pages', label: 'Command center', icon: LayoutDashboard, path: '/' },
  { id: 'page-students', group: 'Pages', label: 'Students', icon: GraduationCap, path: '/students' },
  { id: 'page-structure', group: 'Pages', label: 'Academic structure', icon: Building2, path: '/academic-structure' },
  { id: 'page-regulations', group: 'Pages', label: 'Regulations', icon: BookOpenCheck, path: '/regulations' },
  { id: 'page-rules', group: 'Pages', label: 'Rule engine', icon: GitBranch, path: '/rule-engine' },
  { id: 'page-simulator', group: 'Pages', label: 'Simulator', icon: FlaskConical, path: '/simulator' },
  { id: 'page-users', group: 'Pages', label: 'Users & roles', icon: Users, path: '/users' },
  { id: 'page-reports', group: 'Pages', label: 'Reports', icon: FileBarChart, path: '/reports' },
]

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [entityCommands, setEntityCommands] = useState<CommandItem[]>([])
  const [entitiesLoaded, setEntitiesLoaded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      window.setTimeout(() => inputRef.current?.focus(), 0)

      // Lazy-loaded once per session, on first open — search results are
      // real backend records (respecting each role's own visibility rules,
      // same as the Students/Regulations pages), not the static demo data
      // this used to read from. A quick-nav palette doesn't need to
      // refetch on every open; results just won't reflect edits made
      // elsewhere until the next reload.
      if (!entitiesLoaded) {
        setEntitiesLoaded(true)
        Promise.all([studentsApi.list(), regulationsApi.list(), programsApi.list()])
          .then(([studentRows, regulationRows, programRows]) => {
            const programName = (programId: string) => programRows.find((p) => p.id === programId)?.name ?? 'Unknown program'
            setEntityCommands([
              ...studentRows.map((s): CommandItem => ({
                id: `student-${s.id}`,
                group: 'Students',
                label: s.name,
                detail: `${s.studentId} · ${programName(s.programId)}`,
                icon: GraduationCap,
                path: '/students',
              })),
              ...regulationRows.map((r): CommandItem => ({
                id: `regulation-${r.id}`,
                group: 'Regulations',
                label: r.name,
                detail: `${r.code} · v${r.version}`,
                icon: BookOpenCheck,
                path: `/regulations/${r.id}`,
              })),
            ])
          })
          .catch(() => {
            // Search still works for page navigation even if this fails —
            // not worth a visible error for a quick-nav convenience feature.
          })
      }
    }
  }, [open, entitiesLoaded])

  const allCommands = useMemo(() => [...pageCommands, ...entityCommands], [entityCommands])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = !q ? pageCommands : allCommands.filter((c) => c.label.toLowerCase().includes(q) || c.detail?.toLowerCase().includes(q))
    return matches.slice(0, 8)
  }, [query, allCommands])

  useEffect(() => {
    setActiveIndex(0)
  }, [results.length])

  function select(item: CommandItem) {
    navigate(item.path)
    onClose()
  }

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && results[activeIndex]) {
        e.preventDefault()
        select(results[activeIndex])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results, activeIndex])

  if (!open) return null

  let lastGroup = ''

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#0f172a]/50 px-4 pt-[12vh]" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden border border-[#e2e8f0] bg-[#ffffff] shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-[#e2e8f0] px-4 py-3">
          <Search size={17} className="text-[#64748b]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, students, regulations..."
            className="flex-1 bg-transparent text-sm text-[#0f172a] placeholder-[#94a3b8] outline-none"
          />
          <kbd className="rounded border border-[#e2e8f0] px-1.5 py-0.5 text-[10px] text-[#64748b]">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-[#94a3b8]">No matches for "{query}".</p>
          ) : (
            results.map((item, index) => {
              const showGroupHeader = item.group !== lastGroup
              lastGroup = item.group
              const Icon = item.icon
              return (
                <div key={item.id}>
                  {showGroupHeader && (
                    <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">{item.group}</p>
                  )}
                  <button
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => select(item)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm ${
                      index === activeIndex ? 'bg-[#f1f5f9] text-[#0f172a]' : 'text-[#475569]'
                    }`}
                  >
                    <Icon size={15} className="shrink-0 text-[#64748b]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.label}</span>
                      {item.detail && <span className="block truncate text-xs text-[#94a3b8]">{item.detail}</span>}
                    </span>
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
