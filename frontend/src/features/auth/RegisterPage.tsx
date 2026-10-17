import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState, useEffect, useMemo } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { GitBranch, Loader2, AlertCircle, Eye, EyeOff, GraduationCap, Building2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import FormField, { inputClassName, inputErrorClassName } from '@/components/ui/FormField'
import * as departmentsApi from '@/api/departments'
import * as programsApi from '@/api/programs'
import type { Department, Program } from '@/types'

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid university email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  studentId: z.string().trim().min(3, 'Student ID / Roll number is required.').toUpperCase(),
  departmentId: z.string().min(1, 'Please select your department.'),
  programId: z.string().min(1, 'Please select your academic program.'),
  year: z.coerce.number().int().min(1, 'Year must be at least 1.').max(6, 'Year must be at most 6.'),
})

type FormValues = z.infer<typeof schema>

export default function RegisterPage() {
  const { register: registerAuth, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [departments, setDepartments] = useState<Department[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [loadingMetadata, setLoadingMetadata] = useState(true)
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      studentId: '',
      departmentId: '',
      programId: '',
      year: 1,
    },
  })

  const selectedDepartmentId = watch('departmentId')

  // Load departments and programs
  useEffect(() => {
    async function loadData() {
      try {
        const [deptList, progList] = await Promise.all([
          departmentsApi.list(),
          programsApi.list(),
        ])
        setDepartments(deptList)
        setPrograms(progList)
        if (deptList.length > 0) {
          setValue('departmentId', deptList[0].id)
        }
      } catch {
        setServerError('Unable to load department catalog.')
      } finally {
        setLoadingMetadata(false)
      }
    }
    loadData()
  }, [setValue])

  // Filter programs based on selected department
  const availablePrograms = useMemo(() => {
    if (!selectedDepartmentId) return programs
    return programs.filter((p) => p.departmentId === selectedDepartmentId)
  }, [programs, selectedDepartmentId])

  // Auto-select first program when department changes
  useEffect(() => {
    if (availablePrograms.length > 0) {
      setValue('programId', availablePrograms[0].id)
    } else {
      setValue('programId', '')
    }
  }, [availablePrograms, setValue])

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(values: FormValues) {
    setServerError('')
    const result = await registerAuth({
      name: values.name,
      email: values.email,
      password: values.password,
      studentId: values.studentId,
      programId: values.programId,
      year: values.year,
    })

    if (result.ok) {
      setSuccess(true)
      setTimeout(() => navigate('/'), 1200)
    } else {
      setServerError(result.error)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#0f172a] text-[#818cf8]">
            <GitBranch size={22} strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#0f172a]">Student Registration</h1>
          <p className="mt-1 text-xs text-[#64748b]">
            Create your student portal account to track grades, SGPA & regulations
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="rounded-2xl border border-[#e2e8f0] bg-[#ffffff] p-6 shadow-sm sm:p-8"
        >
          {serverError && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border-l-4 border-[#dc2626] bg-[#fee2e2] p-3 text-xs font-semibold text-[#dc2626]">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {success && (
            <div role="status" className="mb-4 flex items-center gap-2 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-xs font-bold text-[#15803d]">
              <CheckCircle2 size={16} />
              <span>Account created! Redirecting to student portal...</span>
            </div>
          )}

          {/* Full Name */}
          <FormField label="Full Name" htmlFor="name" error={errors.name?.message} required>
            <input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="e.g. Priya Sharma"
              className={errors.name ? inputErrorClassName : inputClassName}
              {...register('name')}
            />
          </FormField>

          {/* Email */}
          <FormField label="University Email" htmlFor="email" error={errors.email?.message} required>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="student@university.edu"
              className={errors.email ? inputErrorClassName : inputClassName}
              {...register('email')}
            />
          </FormField>

          {/* Student ID / Roll Number */}
          <FormField label="Student ID / Roll No." htmlFor="studentId" error={errors.studentId?.message} required>
            <input
              id="studentId"
              type="text"
              placeholder="e.g. STU2024099"
              className={errors.studentId ? inputErrorClassName : inputClassName}
              {...register('studentId')}
            />
          </FormField>

          {/* Department & Program Row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="reg-dept" className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                <Building2 size={12} className="text-[#64748b]" /> Department
              </label>
              <select
                id="reg-dept"
                className={errors.departmentId ? inputErrorClassName : inputClassName}
                disabled={loadingMetadata}
                {...register('departmentId')}
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="reg-prog" className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                <GraduationCap size={12} className="text-[#64748b]" /> Program
              </label>
              <select
                id="reg-prog"
                className={errors.programId ? inputErrorClassName : inputClassName}
                disabled={loadingMetadata || availablePrograms.length === 0}
                {...register('programId')}
              >
                {availablePrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {errors.programId && (
                <p className="mt-1 text-[11px] text-[#dc2626]">{errors.programId.message}</p>
              )}
            </div>
          </div>

          {/* Current Year */}
          <div className="mt-3">
            <FormField label="Current Year of Study" htmlFor="year" required>
              <select id="year" className={inputClassName} {...register('year')}>
                <option value="1">Year 1 (Semester 1 & 2)</option>
                <option value="2">Year 2 (Semester 3 & 4)</option>
                <option value="3">Year 3 (Semester 5 & 6)</option>
                <option value="4">Year 4 (Semester 7 & 8)</option>
              </select>
            </FormField>
          </div>

          {/* Password */}
          <FormField label="Password" htmlFor="password" error={errors.password?.message} required>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                className={`${errors.password ? inputErrorClassName : inputClassName} pr-10`}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FormField>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || success}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#4338ca] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#3730a3] disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : null}
            {isSubmitting ? 'Creating account...' : 'Create Student Account'}
          </button>

          {/* Back to Login link */}
          <div className="mt-5 border-t border-[#f1f5f9] pt-4 text-center">
            <p className="text-xs text-[#64748b]">
              Already registered?{' '}
              <Link to="/login" className="font-bold text-[#4338ca] hover:underline">
                Sign in to your account
              </Link>
            </p>
          </div>
        </form>
      </div>
    </main>
  )
}
