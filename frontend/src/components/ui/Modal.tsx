import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  widthClassName?: string
}

export default function Modal({ open, title, description, onClose, children, widthClassName = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#102b35]/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full overflow-y-auto border border-[#e4e1da] bg-[#fbfaf7] shadow-xl ${widthClassName}`}
      >
        <div className="flex items-start justify-between border-b border-[#e4e1da] px-6 py-5">
          <div>
            <h2 id="modal-title" className="font-display text-lg font-bold text-[#102b35]">
              {title}
            </h2>
            {description && <p className="mt-1 text-xs text-[#718684]">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded p-1 text-[#557071] hover:bg-[#e4e1da]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
