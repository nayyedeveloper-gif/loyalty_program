import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import api from '../lib/api'
import { useAuth } from './AuthContext'

const NotificationContext = createContext(null)

const POLL_MS = 15000

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const fetchingRef = useRef(false)
  const unreadRef = useRef(0)

  useEffect(() => {
    unreadRef.current = unreadCount
  }, [unreadCount])

  const refreshUnread = useCallback(async () => {
    if (!user?.id || !localStorage.getItem('token')) {
      setUnreadCount(0)
      return 0
    }
    if (fetchingRef.current) return unreadRef.current
    fetchingRef.current = true
    try {
      const { data } = await api.get('/notifications/unread-count')
      const next = Number(data.unread_count || 0)
      setUnreadCount(next)
      return next
    } catch {
      return unreadRef.current
    } finally {
      fetchingRef.current = false
    }
  }, [user?.id])

  const clearUnread = useCallback(() => {
    setUnreadCount(0)
  }, [])

  const markAllRead = useCallback(async () => {
    if (!user?.id) return
    const previous = unreadRef.current
    setUnreadCount(0)
    try {
      await api.post('/notifications/read-all')
    } catch (err) {
      setUnreadCount(previous)
      throw err
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0)
      return undefined
    }

    refreshUnread()

    const timer = window.setInterval(() => {
      refreshUnread()
    }, POLL_MS)

    function onFocus() {
      refreshUnread()
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') refreshUnread()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user?.id, refreshUnread])

  const value = useMemo(
    () => ({
      unreadCount,
      setUnreadCount,
      refreshUnread,
      clearUnread,
      markAllRead,
    }),
    [unreadCount, refreshUnread, clearUnread, markAllRead],
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
