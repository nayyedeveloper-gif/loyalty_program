import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../../context/LanguageContext'
import { Modal } from './ui'

const STORAGE_KEY = 'spin_grant_notice'

export default function SpinGrantNotice() {
  const { t } = useLanguage()
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
          <h3>{notice.title || t('spinGiftTitle')}</h3>
          <p>{notice.message}</p>
          {notice.count ? (
            <p className="promo-offer-meta">
              {t('spinGiftMeta', { count: notice.count })}
            </p>
          ) : null}
          <div className="dialog-actions">
            <button type="button" className="cx-ghost" onClick={dismiss}>
              {t('spinGiftLater')}
            </button>
            <Link className="btn-spin" to="/app/spinwheel" onClick={dismiss} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              {t('spinGiftOpen')}
            </Link>
          </div>
        </>
      )}
    </Modal>
  )
}
