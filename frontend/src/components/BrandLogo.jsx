import { Link } from 'react-router-dom'
import { useAppSettings } from '../context/AppSettingsContext'
import { useLanguage } from '../context/LanguageContext'

export default function BrandLogo({
  to = '/',
  size = 'md',
  showText = true,
  variant = 'light',
  className = '',
}) {
  const { t } = useLanguage()
  const { appName, appTagline, appLogoUrl } = useAppSettings()
  const brandName = appName || t('brandTitle')
  const brandSubtitle = appTagline || t('brandSubtitle')
  const logoSrc = appLogoUrl || '/brand/29-logo.png'

  const content = (
    <>
      <img
        src={logoSrc}
        alt={showText ? '' : brandName}
        className={`brand-logo-mark brand-logo-mark-${size}`}
      />
      {showText && (
        <span className="brand-logo-text">
          <span className="brand-logo-title">{brandName}</span>
          <span className="brand-logo-subtitle">{brandSubtitle}</span>
        </span>
      )}
    </>
  )

  const classes = [
    'brand-logo',
    `brand-logo-${size}`,
    `brand-logo-${variant}`,
    showText ? 'has-text' : 'logo-only',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (to === false) {
    return (
      <div className={classes} {...(showText ? {} : { 'aria-label': brandName })}>
        {content}
      </div>
    )
  }

  return (
    <Link
      to={to}
      className={classes}
      aria-label={showText ? undefined : brandName}
    >
      {content}
    </Link>
  )
}
