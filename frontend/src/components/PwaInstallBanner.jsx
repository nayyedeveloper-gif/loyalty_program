import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLanguage } from '../context/LanguageContext'
import { faGem, faXmark } from '../lib/icons'

function isIosSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const webkit = /WebKit/.test(ua)
  const notOther = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return iOS && webkit && notOther
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

export default function PwaInstallBanner() {
  const { t } = useLanguage()
  const [deferred, setDeferred] = useState(null)
  const [visible, setVisible] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('pwaInstallDismissed') === '1') return
    if (isStandalone()) return

    if (isIosSafari()) {
      setIosHint(true)
      setVisible(true)
      return undefined
    }

    function onBeforeInstall(e) {
      e.preventDefault()
      setDeferred(e)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  if (!visible) return null
  if (!iosHint && !deferred) return null

  async function install() {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setVisible(false)
  }

  function dismiss() {
    localStorage.setItem('pwaInstallDismissed', '1')
    setVisible(false)
  }

  return (
    <div className="pwa-banner" role="region" aria-label={t('installTitle')} aria-live="polite">
      <div className="pwa-banner-copy">
        <FontAwesomeIcon icon={faGem} className="text-[var(--color-primary)]" aria-hidden="true" />
        <div>
          <strong>{t('installTitle')}</strong>
          <p>{iosHint ? t('installCopyIos') : t('installCopy')}</p>
        </div>
      </div>
      <div className="pwa-banner-actions">
        {!iosHint ? (
          <button type="button" className="btn btn-primary" onClick={install}>
            {t('install')}
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost btn-icon-action" onClick={dismiss} aria-label={t('dismiss')}>
          <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
          <span className="btn-tooltip">{t('dismiss')}</span>
        </button>
      </div>
    </div>
  )
}
