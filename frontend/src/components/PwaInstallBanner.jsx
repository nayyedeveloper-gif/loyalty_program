import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLanguage } from '../context/LanguageContext'
import { faGem, faXmark } from '../lib/icons'

export default function PwaInstallBanner() {
  const { t } = useLanguage()
  const [deferred, setDeferred] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('pwaInstallDismissed') === '1') return

    function onBeforeInstall(e) {
      e.preventDefault()
      setDeferred(e)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  if (!visible || !deferred) return null

  async function install() {
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
          <p>{t('installCopy')}</p>
        </div>
      </div>
      <div className="pwa-banner-actions">
        <button type="button" className="btn btn-primary" onClick={install}>
          {t('install')}
        </button>
        <button type="button" className="btn btn-ghost btn-icon-action" onClick={dismiss} aria-label={t('dismiss')}>
          <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
          <span className="btn-tooltip">{t('dismiss')}</span>
        </button>
      </div>
    </div>
  )
}
