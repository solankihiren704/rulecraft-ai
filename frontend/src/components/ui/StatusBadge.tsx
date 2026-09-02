import { AlertCircle, Archive, CheckCircle2, Clock } from 'lucide-react'

const STATUS_STYLES: Record<string, { classes: string; icon: typeof CheckCircle2 }> = {
  published: { classes: 'bg-[#dcfce7] text-[#16a34a]', icon: CheckCircle2 },
  active: { classes: 'bg-[#dcfce7] text-[#16a34a]', icon: CheckCircle2 },
  eligible: { classes: 'bg-[#dcfce7] text-[#16a34a]', icon: CheckCircle2 },
  draft: { classes: 'bg-[#fef3c7] text-[#d97706]', icon: Clock },
  review: { classes: 'bg-[#fee2e2] text-[#dc2626]', icon: AlertCircle },
  suspended: { classes: 'bg-[#fee2e2] text-[#dc2626]', icon: AlertCircle },
  not_eligible: { classes: 'bg-[#fee2e2] text-[#dc2626]', icon: AlertCircle },
  rejected: { classes: 'bg-[#fee2e2] text-[#dc2626]', icon: AlertCircle },
  archived: { classes: 'bg-[#f1f5f9] text-[#475569]', icon: Archive },
  graduated: { classes: 'bg-[#dbeafe] text-[#2563eb]', icon: CheckCircle2 },
}

export default function StatusBadge({ status, label }: { status: string; label?: string }) {
  const style = STATUS_STYLES[status] ?? { classes: 'bg-[#f1f5f9] text-[#475569]', icon: Clock }
  const Icon = style.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold capitalize ${style.classes}`}>
      <Icon size={12} />
      {(label ?? status).replace(/_/g, ' ')}
    </span>
  )
}
