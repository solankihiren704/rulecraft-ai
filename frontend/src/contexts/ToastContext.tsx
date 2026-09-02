import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

interface ToastState {
  id: number
  message: string
  tone: 'success' | 'error'
}

interface ToastContextValue {
  showToast: (message: string, tone?: 'success' | 'error') => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timeoutRef = useRef<number | null>(null)

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    setToast({ id: Date.now(), message, tone })
    timeoutRef.current = window.setTimeout(() => setToast(null), 2800)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 border px-4 py-3 text-xs font-semibold text-white shadow-lg ${
            toast.tone === 'success' ? 'border-[#2b4b51] bg-[#102b35]' : 'border-[#7a2c1b] bg-[#b94e37]'
          }`}
        >
          {toast.tone === 'success' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
