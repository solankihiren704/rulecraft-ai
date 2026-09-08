import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { nextId } from '@/services/mockData'
import type { AiMessage } from '@/types'

interface AiAssistantContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  messages: AiMessage[]
  addMessage: (message: AiMessage) => void
  /** Opens the assistant and appends a ready-made reply — used by pages that
   *  already have an analysis result to hand over (e.g. a batch simulation
   *  summary), rather than routing it through the "type a question" flow. */
  presentSummary: (content: string) => void
}

const AiAssistantContext = createContext<AiAssistantContextValue | null>(null)

export function useAiAssistant() {
  const ctx = useContext(AiAssistantContext)
  if (!ctx) throw new Error('useAiAssistant must be used within an AiAssistantProvider')
  return ctx
}

export function AiAssistantProvider({ children, initialMessages }: { children: ReactNode; initialMessages: AiMessage[] }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<AiMessage[]>(initialMessages)

  const addMessage = useCallback((message: AiMessage) => setMessages((prev) => [...prev, message]), [])

  const presentSummary = useCallback((content: string) => {
    setMessages((prev) => [...prev, { id: nextId('ai'), role: 'assistant', content, at: new Date().toISOString() }])
    setOpen(true)
  }, [])

  const value = useMemo(() => ({ open, setOpen, messages, addMessage, presentSummary }), [open, messages, addMessage, presentSummary])

  return <AiAssistantContext.Provider value={value}>{children}</AiAssistantContext.Provider>
}
