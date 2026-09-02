import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { GitBranch, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import FormField, { inputClassName, inputErrorClassName } from '@/components/ui/FormField'

const schema = z.object({
  email: z.string().min(1, 'Email is required.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
})

type FormValues = z.infer<typeof schema>

const DEMO_PASSWORD = 'Demo@1234'

const demoAccounts = [
  { role: 'Super Admin', email: 'aarav.kulkarni@rulecraft.edu' },
  { role: 'HOD', email: 'meera.nair@rulecraft.edu' },
  { role: 'Faculty', email: 'sanjay.verma@rulecraft.edu' },
  { role: 'Student', email: 'rajesh.kumar@university.edu' },
]

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const location = useLocation()
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  async function onSubmit(values: FormValues) {
    setServerError('')
    const result = await login(values.email, values.password)
    if (!result.ok) {
      setServerError(result.error)
    }
  }

  function fillDemo(email: string) {
    setValue('email', email)
    setValue('password', DEMO_PASSWORD)
    setServerError('')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#0f172a] text-[#818cf8]">
            <GitBranch size={22} strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-xl font-bold text-[#0f172a]">RuleCraft</h1>
          <p className="mt-1 text-xs text-[#64748b]">Academic Regulation Builder</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="border border-[#e2e8f0] bg-[#ffffff] p-6 shadow-sm"
        >
          {serverError && (
            <div role="alert" className="mb-4 flex items-start gap-2 border-l-4 border-[#dc2626] bg-[#fee2e2] p-3 text-xs font-semibold text-[#dc2626]">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {serverError}
            </div>
          )}

          <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@university.edu"
              className={errors.email ? inputErrorClassName : inputClassName}
              {...register('email')}
            />
          </FormField>

          <FormField label="Password" htmlFor="password" error={errors.password?.message} required>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className={`${errors.password ? inputErrorClassName : inputClassName} pr-10`}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-[#94a3b8] hover:text-[#475569]"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FormField>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e293b] disabled:cursor-wait disabled:opacity-70"
          >
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-5 border border-[#e2e8f0] bg-white p-4 text-xs">
          <p className="mb-2 font-semibold text-[#475569]">Demo accounts (seeded database, password Demo@1234)</p>
          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map((account) => (
              <button
                type="button"
                key={account.email}
                onClick={() => fillDemo(account.email)}
                className="rounded border border-[#e2e8f0] px-2 py-1.5 text-left text-[#475569] hover:bg-[#f1f5f9]"
              >
                <span className="block font-semibold text-[#0f172a]">{account.role}</span>
                <span className="block truncate text-[10px] text-[#94a3b8]">{account.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
