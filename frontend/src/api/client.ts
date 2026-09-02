import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { AuthUser } from '@/types'

/**
 * client.ts
 * Single axios instance every API module imports. Handles attaching the
 * in-memory access token, and transparently refreshing it (via the
 * httpOnly refresh cookie) on a 401 before retrying the original request
 * once. The access token is kept in memory only (not localStorage) — a
 * page reload re-establishes it through /auth/refresh in AuthContext.
 */

export interface ApiErrorPayload {
  success: false
  message: string
  errors?: Record<string, string>
}

export class ApiRequestError extends Error {
  status?: number
  fieldErrors?: Record<string, string>

  constructor(message: string, status?: number, fieldErrors?: Record<string, string>) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

// In dev, Vite proxies /api to the backend (see vite.config.ts), so the
// relative default works. A production build served standalone (e.g. the
// Docker Compose setup, where the frontend and backend are different
// origins with no reverse proxy) needs VITE_API_URL pointed at the real
// backend origin, or every request here silently targets the frontend's
// own origin instead.
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`)
  }
  return config
})

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

export interface AuthSessionPayload {
  user: AuthUser
  accessToken: string
}

let refreshPromise: Promise<AuthSessionPayload | null> | null = null

// The backend's refresh token is single-use (rotated on every call), so two
// concurrent callers hitting this at once — e.g. React StrictMode
// double-invoking an effect, or two apiClient requests 401ing at the same
// time — must not both fire the network call: the second would race the
// first, present an already-rotated token, and get a spurious 401. All
// callers share this one in-flight promise instead.
export async function refreshSession(): Promise<AuthSessionPayload | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ success: true; data: AuthSessionPayload }>(`${API_BASE_URL}/auth/refresh`, null, {
        withCredentials: true,
      })
      .then((res) => {
        const payload = res.data.data
        setAccessToken(payload.accessToken)
        return payload
      })
      .catch(() => {
        setAccessToken(null)
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiErrorPayload>) => {
    const config = error.config as RetriableConfig | undefined
    const status = error.response?.status
    const url = config?.url ?? ''
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh')

    if (status === 401 && config && !config._retry && !isAuthEndpoint) {
      config._retry = true
      const session = await refreshSession()
      if (session) {
        config.headers.set('Authorization', `Bearer ${session.accessToken}`)
        return apiClient(config)
      }
    }

    // A request made with responseType: 'blob' (file downloads) still gets
    // its error body parsed as a Blob, not JSON, even on failure — so the
    // usual `error.response.data.message` read comes back undefined here.
    // Read the blob back out as text and parse it the same way.
    const rawData = error.response?.data as unknown
    if (rawData instanceof Blob && rawData.type.includes('json')) {
      try {
        const text = await rawData.text()
        const parsed = JSON.parse(text) as ApiErrorPayload
        return Promise.reject(new ApiRequestError(parsed.message, status, parsed.errors))
      } catch {
        // fall through to the generic message below
      }
    }

    const message = error.response?.data?.message ?? error.message ?? 'Something went wrong.'
    return Promise.reject(new ApiRequestError(message, status, error.response?.data?.errors))
  },
)
