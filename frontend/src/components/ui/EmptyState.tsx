import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="border border-dashed border-[#d8d3c8] bg-[#fbfaf7] py-14 text-center">
      <Icon className="mx-auto mb-3 text-[#b8c5bd]" size={28} />
      <p className="font-semibold text-[#173640]">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-[#9aa8a5]">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-lg bg-[#102b35] px-4 py-2 text-xs font-semibold text-white hover:bg-[#204853]"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
