import { useEffect, useRef } from 'react'
import api from '../../../lib/api'

/**
 * Polls a lightweight wheel revision endpoint and reloads the full published
 * wheel whenever admin content changes — so customer/guest UIs stay in sync.
 *
 * Default interval is intentionally calm (15s). Focus / tab-visible still
 * probe immediately so publishes feel responsive without hammering the API.
 */
export function useLiveWheelSync({
  enabled = true,
  intervalMs = 15000,
  onChange,
  onWheelChange,
}) {
  const callback = onWheelChange || onChange
  const onChangeRef = useRef(callback)
  const signatureRef = useRef(null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    onChangeRef.current = onWheelChange || onChange
  }, [onChange, onWheelChange])

  useEffect(() => {
    if (!enabled) return undefined

    let cancelled = false
    let timer = 0

    const probe = async () => {
      if (cancelled || inFlightRef.current || document.hidden) return
      inFlightRef.current = true
      try {
        const { data: revision } = await api.get('/spinwheel/wheel/published/revision')
        if (!revision?.signature || cancelled) return

        if (signatureRef.current === null) {
          signatureRef.current = revision.signature
          return
        }
        if (signatureRef.current === revision.signature) return

        const { data: wheel } = await api.get('/spinwheel/wheel/published')
        if (cancelled) return
        signatureRef.current = revision.signature
        await onChangeRef.current?.(wheel)
      } catch {
        /* ignore transient network blips */
      } finally {
        inFlightRef.current = false
      }
    }

    const schedule = () => {
      window.clearInterval(timer)
      timer = window.setInterval(() => {
        void probe()
      }, intervalMs)
    }

    const onFocus = () => {
      void probe()
    }
    const onVisible = () => {
      if (document.hidden) {
        window.clearInterval(timer)
        timer = 0
        return
      }
      schedule()
      void probe()
    }

    schedule()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    void probe()

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, intervalMs])
}

export default useLiveWheelSync
