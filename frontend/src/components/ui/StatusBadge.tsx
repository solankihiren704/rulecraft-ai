import { AlertCircle, Archive, CheckCircle2, Clock } from 'lucide-react'

const STATUS_STYLES: Record<string, { classes: string; icon: typeof CheckCircle2 }> = {
  published: { classes: 'bg-[#d8f4ed] text-[#087f72]', icon: CheckCircle2 },
  active: { classes: 'bg-[#d8f4ed] text-[#087f72]', icon: CheckCircle2 },
  eligible: { classes: 'bg-[#d8f4ed] text-[#087f72]', icon: CheckCircle2 },
  draft: { classes: 'bg-[#fff0c7] text-[#997016]', icon: Clock },
  review: { classes: 'bg-[#ffe1d8] text-[#b94e37]', icon: AlertCircle },
  suspended: { classes: 'bg-[#fce3d8] text-[#a94e37]', icon: AlertCircle },
  not_eligible: { classes: 'bg-[#fce3d8] text-[#a94e37]', icon: AlertCircle },
  rejected: { classes: 'bg-[#fce3d8] text-[#a94e37]', icon: AlertCircle },
  archived: { classes: 'bg-[#edf0eb] text-[#617773]', icon: Archive },
  graduated: { classes: 'bg-[#dceafa] text-[#2d65a1]', icon: CheckCircle2 },
}

export default function StatusBadge({ status, label }: { status: string; label?: string }) {
  const style = STATUS_STYLES[status] ?? { classes: 'bg-[#edf0eb] text-[#617773]', icon: Clock }
  const Icon = style.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold capitalize ${style.classes}`}>
      <Icon size={12} />
      {(label ?? status).replace(/_/g, ' ')}
    </span>
  )
}
