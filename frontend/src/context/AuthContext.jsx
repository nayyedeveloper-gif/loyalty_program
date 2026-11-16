import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import api, { getErrorMessage } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null')
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }

    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.user)
        localStorage.setItem('user', JSON.stringify(res.data.user))
      })
      .catch(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo(() => {
    async function login(payload) {
      const { data } = await api.post('/auth/login', payload)
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
      return data.user
    }

    async function register(payload) {
      const { data } = await api.post('/auth/register', payload)
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
      return data.user
    }

    async function logout() {
      try {
        await api.post('/auth/logout')
      } catch {
        // ignore
      }
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setUser(null)
    }

    return {
      user,
      loading,
      login,
      register,
      logout,
      setUser,
      isAdmin: user?.role === 'admin',
      isStaff: user?.role === 'staff',
      isPortalUser: user?.role === 'admin' || user?.role === 'staff',
      isCustomer: user?.role === 'customer',
      getErrorMessage,
    }
  }, [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
