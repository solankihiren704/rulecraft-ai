import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { ApiRequestError } from '@/api/client'

const DEMO_SUPER_ADMIN = {
  id: 'demo-super-admin',
  name: 'Aarav Kulkarni',
  email: 'aarav.kulkarni@rulecraft.edu',
  role: 'super_admin' as const,
  avatarInitials: 'AK',
}

vi.mock('@/api/auth', () => ({
  login: vi.fn(async (email: string) => {
    if (email === DEMO_SUPER_ADMIN.email) {
      return { user: DEMO_SUPER_ADMIN, accessToken: 'test-access-token' }
    }
    throw new ApiRequestError('No account matches that email and password.', 401)
  }),
  refresh: vi.fn(async () => {
    throw new ApiRequestError('No session.', 401)
  }),
  logout: vi.fn(async () => {}),
  me: vi.fn(async () => DEMO_SUPER_ADMIN),
}))

vi.mock('@/api/dashboard', () => ({
  summary: vi.fn(async () => ({
    students: { total: 7, active: 5, byDepartment: [{ departmentName: 'Computer Science', count: 4 }] },
    regulations: { total: 6, byStatus: [{ status: 'published', count: 3 }, { status: 'draft', count: 2 }, { status: 'review', count: 1 }] },
    rules: { total: 7, active: 6, byType: [{ type: 'attendance', count: 3 }] },
    simulations: { total: 8, byOutcome: [{ outcome: 'eligible', count: 4 }], byDay: [{ date: '2026-08-30', count: 5 }] },
    reports: { totalGeneratedByMe: 0 },
    recentActivity: [{ type: 'simulation', description: 'Rajesh Kumar — eligible', at: new Date().toISOString() }],
    generatedAt: new Date().toISOString(),
  })),
}))

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('redirects unauthenticated visitors to the login page', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: /rulecraft/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('logs in with a demo account and reaches the dashboard', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('button', { name: /sign in/i })
    await user.click(screen.getByRole('button', { name: /super admin/i }))
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(screen.getByText(/good morning/i)).toBeInTheDocument(), { timeout: 8000 })
    expect(screen.getByText('Regulation status')).toBeInTheDocument()
  })
})
