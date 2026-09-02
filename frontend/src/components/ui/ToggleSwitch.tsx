interface ToggleSwitchProps {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  label?: string
  ariaLabel?: string
}

export default function ToggleSwitch({ checked, onChange, disabled, label, ariaLabel }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      onClick={onChange}
      className={`inline-flex items-center gap-2 ${disabled ? 'cursor-default' : 'cursor-pointer'} disabled:opacity-50`}
    >
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#16a34a]' : 'bg-[#cbd5e1]'}`}>
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </span>
      {label && <span className="text-[11px] font-semibold text-[#64748b]">{label}</span>}
    </button>
  )
}
