import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Send, Sparkles } from 'lucide-react'
import { aiWelcomeMessages, nextId } from '@/services/mockData'
import type { AiMessage } from '@/types'

const suggestedPrompts = [
  'Draft a rule requiring 75% attendance to sit for exams.',
  'Explain why a student with 4 backlogs is not eligible for promotion.',
  'Summarize the Academic Performance Policy 2024 in 3 bullet points.',
  'Are there any conflicting rules between attendance and grace marks?',
]

function mockAiReply(prompt: string): string {
  const lower = prompt.toLowerCase()
  if (lower.includes('draft') || lower.includes('rule')) {
    return 'Here is a draft rule: IF attendancePercent >= 75 THEN outcome = "Eligible to sit for semester exams". You can refine the threshold and field names in the Rule Engine before activating it — I never activate rules myself.'
  }
  if (lower.includes('explain') || lower.includes('why')) {
    return 'Based on the rule engine result: the student did not meet the backlog limit condition (activeBacklogs <= 4). This is a deterministic outcome from the published regulation, not an AI judgment — I am only explaining it in plain language.'
  }
  if (lower.includes('summar')) {
    return 'Summary: (1) Minimum 75% attendance required for exam eligibility. (2) Passing mark is 40% per subject, with up to 8 grace marks. (3) Promotion requires CGPA >= 5.0 and no more than 4 active backlogs.'
  }
  if (lower.includes('conflict')) {
    return 'I checked the active rule set: no direct conflicts detected between attendance and grace-mark rules — they apply to different stages (exam eligibility vs. subject-level pass/fail). I flag potential overlaps for human review; I never resolve them automatically.'
  }
  return "I can help draft rules, explain eligibility outcomes, summarize regulations, or flag likely conflicts. Try one of the suggested prompts, or describe what you'd like in plain English."
}

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<AiMessage[]>(aiWelcomeMessages)
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  // No Gemini backend is wired up yet (GEMINI_API_KEY is unconfigured and
  // there's no /api/ai module) — this page is a preview of the intended
  // experience, not a live assistant. Defaults to "unavailable" so it's
  // never mistaken for a real connection; the checkbox lets you preview
  // what the connected state would look like.
  const [aiAvailable, setAiAvailable] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isThinking])

  function send(prompt?: string) {
    const text = (prompt ?? input).trim()
    if (!text || isThinking) return
    const userMessage: AiMessage = { id: nextId('ai'), role: 'user', content: text, at: new Date().toISOString() }
    setMessages((prev) => [...prev, userMessage])
    setInput('')

    if (!aiAvailable) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId('ai'),
          role: 'assistant',
          content: 'AI Assistant unavailable. Core academic rule evaluation is still available — try the Rule Engine or Simulator directly.',
          at: new Date().toISOString(),
        },
      ])
      return
    }

    setIsThinking(true)
    window.setTimeout(() => {
      setMessages((prev) => [...prev, { id: nextId('ai'), role: 'assistant', content: mockAiReply(text), at: new Date().toISOString() }])
      setIsThinking(false)
    }, 1100)
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-76px)] max-w-[1000px] flex-col px-5 pb-6 pt-8 sm:px-9 lg:px-12">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#e17f5f]">AI Layer (Gemini) · Preview</p>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.04em] text-[#102b35]">AI Assistant</h1>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-[#718684]">
          <input type="checkbox" checked={aiAvailable} onChange={(e) => setAiAvailable(e.target.checked)} className="h-4 w-4 accent-[#087f72]" />
          Preview connected state
        </label>
      </div>

      <div role="status" className="mb-4 flex items-start gap-2 border-l-4 border-[#7f9fb5] bg-[#eef3f7] p-3 text-xs font-semibold text-[#3f5c72]">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        Preview only — no live Gemini connection is configured yet. Replies below are scripted examples of the intended experience, not real AI output.
      </div>

      {!aiAvailable && (
        <div role="status" className="mb-4 flex items-start gap-2 border-l-4 border-[#e2b36c] bg-[#fff8e8] p-3 text-xs font-semibold text-[#997016]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          AI Assistant unavailable. Core academic rule evaluation is still available.
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto border border-[#e4e1da] bg-[#fbfaf7] p-5">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-4 py-3 text-sm ${
                m.role === 'user' ? 'bg-[#102b35] text-white' : 'border border-[#e4e1da] bg-white text-[#173640]'
              }`}
            >
              {m.role === 'assistant' && (
                <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#087f72]">
                  <Sparkles size={11} /> RuleCraft AI
                </p>
              )}
              <p className="leading-relaxed">{m.content}</p>
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 border border-[#e4e1da] bg-white px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9aa8a5] [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9aa8a5] [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9aa8a5]" />
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestedPrompts.map((p) => (
            <button key={p} onClick={() => send(p)} className="border border-[#e4e1da] bg-white px-3 py-1.5 text-xs text-[#557071] hover:bg-[#f0eee8]">
              {p}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        className="mt-3 flex items-center gap-2 border border-[#e4e1da] bg-[#fbfaf7] p-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a rule, request an explanation, or draft a regulation..."
          className="flex-1 bg-transparent px-2 py-2 text-sm text-[#152b35] placeholder-[#9aa8a5] outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || isThinking}
          className="flex items-center gap-2 rounded-lg bg-[#102b35] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#204853] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={14} /> Send
        </button>
      </form>
      <p className="mt-2 text-center text-[10px] text-[#9aa8a5]">
        AI never makes eligibility decisions — the deterministic rule engine is always the authority.
      </p>
    </div>
  )
}
