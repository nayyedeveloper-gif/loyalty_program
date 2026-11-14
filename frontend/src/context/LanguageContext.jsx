import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import translations from '../i18n/translations'

const LanguageContext = createContext(null)

function interpolate(template, vars = {}) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] ?? ''
  })
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('lang') || 'en')

  useEffect(() => {
    localStorage.setItem('lang', lang)
    document.documentElement.lang = lang === 'my' ? 'my' : 'en'
    document.documentElement.dataset.lang = lang
    document.title =
      lang === 'my'
        ? '၂၉ ရွှေနှင့် ရတနာ — အဖွဲ့ဝင်'
        : '29 Gold & Jewellery — Membership'
  }, [lang])

  const value = useMemo(() => {
    function setLang(next) {
      setLangState(next === 'my' ? 'my' : 'en')
    }

    function t(key, vars) {
      const table = translations[lang] || translations.en
      const fallback = translations.en[key] ?? key
      const text = table[key] ?? fallback
      return vars ? interpolate(text, vars) : text
    }

    return { lang, setLang, t, isBurmese: lang === 'my' }
  }, [lang])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
