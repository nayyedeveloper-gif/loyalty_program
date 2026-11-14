import { useLanguage } from '../context/LanguageContext'

export default function LanguageSwitcher({ variant = 'light' }) {
  const { lang, setLang, t } = useLanguage()

  return (
    <div className={`lang-switch ${variant === 'dark' ? 'lang-switch-dark' : ''}`} role="group" aria-label={t('language')}>
      <button
        type="button"
        className={lang === 'en' ? 'active' : ''}
        onClick={() => setLang('en')}
        aria-pressed={lang === 'en'}
      >
        EN
      </button>
      <button
        type="button"
        className={lang === 'my' ? 'active' : ''}
        onClick={() => setLang('my')}
        aria-pressed={lang === 'my'}
      >
        မြန်မာ
      </button>
    </div>
  )
}
