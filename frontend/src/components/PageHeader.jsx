import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLanguage } from '../context/LanguageContext'
import { faChevronLeft } from '../lib/icons'

export default function PageHeader({
  title,
  subtitle,
  icon,
  backTo,
  backLabel,
  actions,
  children,
}) {
  const { t } = useLanguage()
  const label = backLabel || t('back')

  return (
    <header className={`page-header ${backTo ? 'has-back' : ''}`}>
      {backTo ? (
        <Link to={backTo} className="page-back">
          <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
          <span>{label}</span>
        </Link>
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
