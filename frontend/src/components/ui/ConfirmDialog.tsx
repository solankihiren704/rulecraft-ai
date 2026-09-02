import Modal from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} title={title} description={description} onClose={onCancel} widthClassName="max-w-sm">
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="rounded-lg border border-[#e4e1da] px-4 py-2 text-xs font-semibold text-[#486362] hover:bg-[#f0eee8]"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-sm ${
            danger ? 'bg-[#b94e37] hover:bg-[#9c3f2c]' : 'bg-[#102b35] hover:bg-[#204853]'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
