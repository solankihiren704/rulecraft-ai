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
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-[#486362]">
        {label}
        {required && <span className="ml-0.5 text-[#b94e37]">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-[#9aa8a5]">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-[11px] font-semibold text-[#b94e37]">
          {error}
        </p>
      )}
    </div>
  )
}

export const inputClassName =
  'w-full rounded-lg border border-[#e4e1da] bg-white px-3 py-2.5 text-sm text-[#152b35] outline-none placeholder-[#9aa8a5] focus:border-[#68bbae] focus:ring-2 focus:ring-[#68bbae]/30'

export const inputErrorClassName =
  'w-full rounded-lg border border-[#b94e37] bg-white px-3 py-2.5 text-sm text-[#152b35] outline-none placeholder-[#9aa8a5] focus:ring-2 focus:ring-[#b94e37]/30'
