import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from './ui'

const STORAGE_KEY = 'spin_grant_notice'

export default function SpinGrantNotice() {
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!parsed?.message) return
      const ackKey = `spin_grant_ack_${parsed.source || 'registration'}`
      if (localStorage.getItem(ackKey) === String(parsed.count || '')) {
        sessionStorage.removeItem(STORAGE_KEY)
        return
      }
      setNotice(parsed)
    } catch {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const dismiss = () => {
    if (notice) {
      localStorage.setItem(
        `spin_grant_ack_${notice.source || 'registration'}`,
        String(notice.count || ''),
      )
    }
    sessionStorage.removeItem(STORAGE_KEY)
    setNotice(null)
  }

  return (
    <Modal open={!!notice} onClose={dismiss} tone="customer" className="promo-offer-modal">
      {notice && (
        <>
          <h3>{notice.title || 'Spin gift'}</h3>
          <p>{notice.message}</p>
          {notice.count ? (
            <p className="promo-offer-meta">
              You now have <strong>{notice.count}</strong> welcome spin{notice.count === 1 ? '' : 's'} ready.
            </p>
          ) : null}
          <div className="dialog-actions">
            <button type="button" className="cx-ghost" onClick={dismiss}>
              Later
            </button>
            <Link className="btn-spin" to="/app/spinwheel" onClick={dismiss} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              Open Spinwheel
            </Link>
          </div>
        </>
      )}
    </Modal>
  )
}
