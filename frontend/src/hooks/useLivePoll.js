import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Fetches immediately, then keeps data fresh via interval + focus/visibility refresh.
 * Background refreshes never clear existing data (no loading flash).
 */
export default function useLivePoll(fetcher, { intervalMs = 10000, enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const fetcherRef = useRef(fetcher)
  const hasDataRef = useRef(false)
  const inFlightRef = useRef(false)
  const activeRef = useRef(false)

  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  useEffect(() => {
    hasDataRef.current = data != null
  }, [data])

  const refresh = useCallback(async ({ silent = true } = {}) => {
    if (!enabled || !activeRef.current || inFlightRef.current) return
    inFlightRef.current = true
    if (silent) setRefreshing(true)
    try {
      const next = await fetcherRef.current()
      if (!activeRef.current) return
      setData(next)
      setError('')
      setUpdatedAt(Date.now())
    } catch (err) {
      if (!activeRef.current) return
      // Keep last good snapshot on background failures; surface only first-load errors.
      if (!silent || !hasDataRef.current) {
        setError(err)
      }
    } finally {
      inFlightRef.current = false
      if (activeRef.current) setRefreshing(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return undefined

    activeRef.current = true
    inFlightRef.current = false
    refresh({ silent: false })

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refresh({ silent: true })
      }
    }, intervalMs)

    function onFocus() {
      refresh({ silent: true })
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') refresh({ silent: true })
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      activeRef.current = false
      inFlightRef.current = false
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, intervalMs, refresh])

  return { data, error, updatedAt, refreshing, refresh }
}
