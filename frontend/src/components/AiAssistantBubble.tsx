import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AlertTriangle, MessageCircle, Send, Sparkles, X } from 'lucide-react'
import { nextId } from '@/services/mockData'
import { useAiAssistant } from '@/contexts/AiAssistantContext'

const DEFAULT_PROMPTS = [
  'Draft a rule requiring 75% attendance to sit for exams.',
  'Explain why a student with 4 backlogs is not eligible for promotion.',
  'Summarize the Academic Performance Policy 2024 in 3 bullet points.',
]

// Keyed by route prefix so the bubble suggests prompts relevant to what
// you're actually looking at, instead of the same three everywhere.
// Checked in order, first prefix match wins.
const ROUTE_PROMPTS: { prefix: string; prompts: string[] }[] = [
  {
    prefix: '/students',
    prompts: [
      'Explain why a student with 4 backlogs is not eligible for promotion.',
      'Draft a rule requiring a minimum GPA to remain active.',
      'Summarize the Academic Performance Policy 2024 in 3 bullet points.',
    ],
  },
  {
    prefix: '/rule-engine',
    prompts: [
      'Draft a rule requiring 75% attendance to sit for exams.',
      'Are there any conflicting rules between attendance and grace marks?',
      'Explain why a student with 4 backlogs is not eligible for promotion.',
    ],
  },
  {
    prefix: '/simulator',
    prompts: [
      'Explain why a student with 4 backlogs is not eligible for promotion.',
      'Draft a rule requiring 75% attendance to sit for exams.',
      'Summarize the Academic Performance Policy 2024 in 3 bullet points.',
    ],
  },
  {
    prefix: '/regulations',
    prompts: [
      'Summarize the Academic Performance Policy 2024 in 3 bullet points.',
      'Draft a rule requiring 75% attendance to sit for exams.',
      'Are there any conflicting rules between attendance and grace marks?',
    ],
  },
  {
    prefix: '/reports',
    prompts: [
      'Summarize the Academic Performance Policy 2024 in 3 bullet points.',
      'Explain why a student with 4 backlogs is not eligible for promotion.',
    ],
  },
]

function promptsForRoute(pathname: string): string[] {
  return ROUTE_PROMPTS.find((r) => pathname.startsWith(r.prefix))?.prompts ?? DEFAULT_PROMPTS
}

function mockAiReply(prompt: string): string {
  const lower = prompt.toLowerCase()
  if (lower.includes('draft') || lower.includes('rule')) {
    return 'Here is a draft rule: IF attendancePercent >= 75 THEN outcome = "Eligible to sit for semester exams". Refine it in the Rule Engine before activating — I never activate rules myself.'
  }
  if (lower.includes('explain') || lower.includes('why')) {
    return 'Based on the rule engine result: the student did not meet the backlog limit condition (activeBacklogs <= 4). This is a deterministic outcome from the published regulation, not an AI judgment.'
  }
  if (lower.includes('summar')) {
    return 'Summary: (1) Minimum 75% attendance required for exam eligibility. (2) Passing mark is 40% per subject, with up to 8 grace marks. (3) Promotion requires CGPA >= 5.0 and no more than 4 active backlogs.'
  }
  if (lower.includes('conflict')) {
    return 'I checked the active rule set: no direct conflicts detected between attendance and grace-mark rules. I flag potential overlaps for human review; I never resolve them automatically.'
  }
  return "I can help draft rules, explain eligibility outcomes, summarize regulations, or flag likely conflicts. Try a suggestion below, or ask in plain English."
}

// No Gemini backend is wired up yet (GEMINI_API_KEY unconfigured, no /api/ai
// module) — this is a preview of the intended experience, not a live
// assistant. Replies are scripted so it's never mistaken for a real connection.
export default function AiAssistantBubble() {
  const location = useLocation()
  const { open, setOpen, messages, addMessage } = useAiAssistant()
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestedPrompts = useMemo(() => promptsForRoute(location.pathname), [location.pathname])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isThinking])

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  function send(prompt?: string) {
    const text = (prompt ?? input).trim()
    if (!text || isThinking) return
    addMessage({ id: nextId('ai'), role: 'user', content: text, at: new Date().toISOString() })
    setInput('')
    setIsThinking(true)
    window.setTimeout(() => {
      addMessage({ id: nextId('ai'), role: 'assistant', content: mockAiReply(text), at: new Date().toISOString() })
      setIsThinking(false)
    }, 900)
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="RuleCraft AI assistant"
          className="fixed bottom-24 right-5 z-50 flex h-[min(560px,calc(100vh-140px))] w-[min(380px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-[#ffffff] shadow-[0_25px_50px_-8px_rgba(15,23,42,0.5),0_10px_20px_-6px_rgba(15,23,42,0.35)]"
        >
          <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-[#0f172a] px-4 py-3.5 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#818cf8] text-[#0f172a]">
                <Sparkles size={14} />
              </div>
              <div>
                <p className="text-xs font-bold leading-none">RuleCraft AI</p>
                <p className="mt-1 text-[10px] leading-none text-[#94a3b8]">Preview · no live connection</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close AI assistant" className="text-[#94a3b8] hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div role="status" className="flex items-start gap-2 border-b border-[#e2e8f0] bg-[#eff6ff] px-3 py-2 text-[11px] font-semibold text-[#1e40af]">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            Scripted preview replies — the deterministic rule engine is always the real authority.
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                    m.role === 'user' ? 'bg-[#0f172a] text-white' : 'border border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a]'
                  }`}
                >
                  {m.role === 'assistant' && (
                    <p className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-[#16a34a]">
                      <Sparkles size={10} /> RuleCraft AI
                    </p>
                  )}
                  {m.content}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#94a3b8] [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#94a3b8] [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#94a3b8]" />
                </div>
              </div>
            )}
            {messages.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {suggestedPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="rounded-full border border-[#e2e8f0] bg-white px-2.5 py-1 text-left text-[11px] text-[#475569] hover:bg-[#f1f5f9]"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
            className="flex items-center gap-2 border-t border-[#e2e8f0] p-2.5"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a rule or regulation..."
              className="flex-1 rounded-lg bg-[#f1f5f9] px-3 py-2 text-[13px] text-[#0f172a] placeholder-[#94a3b8] outline-none focus:ring-2 focus:ring-[#4f46e5]"
            />
            <button
              type="submit"
              disabled={!input.trim() || isThinking}
              aria-label="Send message"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0f172a] text-white hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#4f46e5] text-white shadow-lg transition hover:scale-105 hover:bg-[#4338ca] active:scale-95"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </>
  )
}
