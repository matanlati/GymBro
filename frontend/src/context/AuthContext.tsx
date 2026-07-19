import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { User } from '../types'
import * as authApi from '../api/auth.api'

interface AuthContextValue {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string, role?: User['role']) => Promise<void>
  googleLogin: (credential: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadUser(): User | null {
  try {
    const str = localStorage.getItem('user')
    const user = str ? (JSON.parse(str) as User) : null
    return user ? { ...user, role: user.role ?? 'trainee' } : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser)

  const handleUser = useCallback((user: User) => {
    localStorage.setItem('user', JSON.stringify(user))
    setUser(user)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login({ email, password })
    handleUser(data.user)
  }, [handleUser])

  const register = useCallback(async (email: string, password: string, name: string, role: User['role'] = 'trainee') => {
    const { data } = await authApi.register({ email, password, name, role })
    handleUser(data.user)
  }, [handleUser])

  const googleLogin = useCallback(async (credential: string) => {
    const { data } = await authApi.googleLogin(credential)
    handleUser(data.user)
  }, [handleUser])

  const logout = useCallback(() => {
    authApi.logout().catch(() => {})
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, register, googleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
