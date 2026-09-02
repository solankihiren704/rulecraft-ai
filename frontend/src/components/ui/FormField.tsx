import type { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}

export default function FormField({ label, htmlFor, error, hint, required, children }: FormFieldProps) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-[#475569]">
        {label}
        {required && <span className="ml-0.5 text-[#dc2626]">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-[#94a3b8]">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-[11px] font-semibold text-[#dc2626]">
          {error}
        </p>
      )}
    </div>
  )
}

export const inputClassName =
  'w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none placeholder-[#94a3b8] focus:border-[#22c55e] focus:ring-2 focus:ring-[#22c55e]/30'

export const inputErrorClassName =
  'w-full rounded-lg border border-[#dc2626] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none placeholder-[#94a3b8] focus:ring-2 focus:ring-[#dc2626]/30'
