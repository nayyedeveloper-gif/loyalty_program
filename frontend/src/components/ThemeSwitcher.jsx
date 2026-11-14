import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { faDesktop, faMoon, faSun } from '../lib/icons'

export default function ThemeSwitcher({ variant = 'cards' }) {
  const { theme, setTheme, toggleTheme, isDark } = useTheme()
  const { t } = useLanguage()

  if (variant === 'icon') {
    return (
      <button
        type="button"
        className="sidebar-panel-toggle"
        onClick={toggleTheme}
        aria-label={isDark ? t('switchToLight') : t('switchToDark')}
        title={isDark ? t('switchToLight') : t('switchToDark')}
      >
        <FontAwesomeIcon icon={isDark ? faSun : faMoon} aria-hidden="true" />
      </button>
    )
  }

  if (variant === 'switch') {
    return (
      <div className="theme-switch" role="group" aria-label={t('theme')}>
        <button
          type="button"
          className={theme === 'light' ? 'active' : ''}
          onClick={() => setTheme('light')}
          aria-pressed={theme === 'light'}
        >
          <FontAwesomeIcon icon={faSun} aria-hidden="true" />
          {t('lightMode')}
        </button>
        <button
          type="button"
          className={theme === 'dark' ? 'active' : ''}
          onClick={() => setTheme('dark')}
          aria-pressed={theme === 'dark'}
        >
          <FontAwesomeIcon icon={faMoon} aria-hidden="true" />
          {t('darkMode')}
        </button>
        <button
          type="button"
          className={theme === 'system' ? 'active' : ''}
          onClick={() => setTheme('system')}
          aria-pressed={theme === 'system'}
        >
          <FontAwesomeIcon icon={faDesktop} aria-hidden="true" />
          {t('systemMode')}
        </button>
      </div>
    )
  }

  const options = [
    { id: 'light', label: t('lightMode'), icon: faSun },
    { id: 'dark', label: t('darkMode'), icon: faMoon },
    { id: 'system', label: t('systemMode'), icon: faDesktop },
  ]

  return (
    <div className="theme-cards" role="group" aria-label={t('theme')}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`theme-card ${theme === option.id ? 'active' : ''}`}
          onClick={() => setTheme(option.id)}
          aria-pressed={theme === option.id}
        >
          <FontAwesomeIcon icon={option.icon} className="theme-card-icon" aria-hidden="true" />
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  )
}
