import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLanguage } from '../context/LanguageContext'
import { faChevronLeft } from '../lib/icons'

export default function PageHeader({
  title,
  subtitle,
  icon,
  showBack = false,
  actions,
  children,
}) {
  const { t } = useLanguage()
  const navigate = useNavigate()

  return (
    <header className={`page-header ${showBack ? 'has-back' : ''}`}>
      {showBack ? (
        <button
          type="button"
          className="page-back"
          onClick={() => navigate(-1)}
          aria-label={t('back')}
        >
          <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
        </button>
      ) : null}

      <div className="page-header-row">
        <div className="page-header-copy">
          <h1 className="page-title">
            {icon ? <FontAwesomeIcon icon={icon} className="text-[var(--color-primary)]" aria-hidden="true" /> : null}
            {title}
          </h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="page-header-actions">{actions}</div> : null}
      </div>

      {children}
    </header>
  )
}
