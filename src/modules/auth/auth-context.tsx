import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { loginApi } from '@/lib/auth-api'

export type UserRole = 'student' | 'teacher' | 'admin'

export interface AuthUser {
  id: string
  username: string
  role: UserRole
}

export interface AuthContextValue {
  user: AuthUser | null
  accessToken: string | null
  login: (username: string, password: string) => Promise<{ user: AuthUser; message: string }>
  logout: () => void
}

const AUTH_USER_STORAGE_KEY = 'nbfe-auth-user'
const AUTH_TOKEN_STORAGE_KEY = 'nbfe-access-token'

const AuthContext = createContext<AuthContextValue | null>(null)

function parseRole(role: string): UserRole {
  if (role === 'student' || role === 'teacher' || role === 'admin') {
    return role
  }
  throw new Error('Invalid role in token')
}

interface JwtPayload {
  sub?: string
  username?: string
  role?: string
  exp?: number
}

function decodeJwtPayload(token: string): JwtPayload {
  try {
    const payloadBase64 = token.split('.')[1]
    if (!payloadBase64) {
      throw new Error('Invalid token format')
    }
    const normalized = payloadBase64.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return JSON.parse(atob(padded)) as JwtPayload
  } catch {
    throw new Error('Cannot decode access token')
  }
}

function readStoredSession(): { user: AuthUser; accessToken: string } | null {
  const accessToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
  if (!accessToken) {
    return null
  }

  try {
    const payload = decodeJwtPayload(accessToken)
    if (payload.exp && payload.exp * 1000 <= Date.now()) {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
      localStorage.removeItem(AUTH_USER_STORAGE_KEY)
      return null
    }

    const fallbackUser = localStorage.getItem(AUTH_USER_STORAGE_KEY)
    const parsedFallbackUser = fallbackUser ? (JSON.parse(fallbackUser) as Partial<AuthUser>) : null

    const user: AuthUser = {
      id: payload.sub ?? parsedFallbackUser?.id ?? crypto.randomUUID(),
      username: payload.username ?? parsedFallbackUser?.username ?? 'unknown',
      role: parseRole(payload.role ?? parsedFallbackUser?.role ?? ''),
    }

    return { user, accessToken }
  } catch {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    localStorage.removeItem(AUTH_USER_STORAGE_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ user: AuthUser; accessToken: string } | null>(() => readStoredSession())

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      login: async (username, password) => {
        const response = await loginApi({ username, password })
        const accessToken = response.data.access_token
        const payload = decodeJwtPayload(accessToken)

        const nextUser: AuthUser = {
          id: payload.sub ?? response.data.user.id,
          username: payload.username ?? response.data.user.username,
          role: parseRole(payload.role ?? response.data.user.role),
        }

        localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, accessToken)
        localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(nextUser))
        setSession({ user: nextUser, accessToken })
        return { user: nextUser, message: response.message }
      },
      logout: () => {
        localStorage.removeItem(AUTH_USER_STORAGE_KEY)
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
        setSession(null)
      },
    }),
    [session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
