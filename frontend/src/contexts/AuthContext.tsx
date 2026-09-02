import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import * as authApi from '@/api/auth'
import { ApiRequestError, setAccessToken } from '@/api/client'
import type { AuthUser } from '@/types'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount there is no access token in memory (it's never persisted), so
  // the only way to know if the visitor already has a session is to try the
  // httpOnly refresh cookie. If it's missing or expired this just fails
  // quietly and the visitor lands on the login page.
  useEffect(() => {
    let cancelled = false
    authApi
      .refresh()
      .then(({ user: refreshedUser }) => {
        if (!cancelled) setUser(refreshedUser)
      })
      .catch(() => {
        setAccessToken(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function login(email: string, password: string) {
    try {
      const { user: loggedInUser, accessToken } = await authApi.login(email, password)
      setAccessToken(accessToken)
      setUser(loggedInUser)
      return { ok: true as const }
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : 'Unable to sign in. Please try again.'
      return { ok: false as const, error: message }
    }
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch {
      // Session may already be invalid server-side (expired token, etc.) —
      // clear local state regardless so the user isn't stuck signed in.
    }
    setAccessToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
