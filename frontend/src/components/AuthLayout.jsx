import LanguageSwitcher from './LanguageSwitcher'
import ThemeSwitcher from './ThemeSwitcher'
import BrandLogo from './BrandLogo'
import { useLanguage } from '../context/LanguageContext'

export default function AuthLayout({ title, subtitle, children, footer }) {
  const { t } = useLanguage()

  return (
    <div className="auth-shell">
      <a href="#auth-main" className="skip-link">{t('skipToContent')}</a>
      <main id="auth-main" className="auth-card" tabIndex={-1}>
        <div className="auth-lang">
          <ThemeSwitcher variant="icon" />
          <LanguageSwitcher />
        </div>
        <div className="auth-header">
          <BrandLogo size="md" to="/" showText={false} className="auth-brand-logo" />
          {title && (
            <h1 className="auth-title">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="auth-subtitle">{subtitle}</p>
          )}
        </div>
        {children}
        {footer && <div className="mt-5 text-center text-sm text-[var(--color-muted)]">{footer}</div>}
      </main>
    </div>
  )
}
