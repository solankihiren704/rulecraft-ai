import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="border border-dashed border-[#cbd5e1] bg-[#ffffff] py-14 text-center">
      <Icon className="mx-auto mb-3 text-[#b8c5bd]" size={28} />
      <p className="font-semibold text-[#0f172a]">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-[#94a3b8]">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b]"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
