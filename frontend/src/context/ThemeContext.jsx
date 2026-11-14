import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialPreference() {
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  return 'system'
}

function resolveTheme(preference) {
  return preference === 'system' ? systemTheme() : preference
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(() => {
    if (typeof window === 'undefined') return 'system'
    return getInitialPreference()
  })
  const [resolved, setResolved] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    return resolveTheme(getInitialPreference())
  })

  useEffect(() => {
    localStorage.setItem('theme', preference)
    const next = resolveTheme(preference)
    setResolved(next)
    document.documentElement.dataset.theme = next
    document.documentElement.dataset.themePreference = preference
    document.documentElement.style.colorScheme = next
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', next === 'dark' ? '#0b1220' : '#3b82f6')
  }, [preference])

  useEffect(() => {
    if (preference !== 'system') return undefined
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const next = systemTheme()
      setResolved(next)
      document.documentElement.dataset.theme = next
      document.documentElement.style.colorScheme = next
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', next === 'dark' ? '#0b1220' : '#3b82f6')
    }
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [preference])

  const value = useMemo(() => {
    function setTheme(next) {
      if (next === 'dark' || next === 'light' || next === 'system') {
        setPreferenceState(next)
      }
    }

    function toggleTheme() {
      setPreferenceState((current) => {
        const effective = current === 'system' ? systemTheme() : current
        return effective === 'dark' ? 'light' : 'dark'
      })
    }

    return {
      theme: preference,
      resolvedTheme: resolved,
      setTheme,
      toggleTheme,
      isDark: resolved === 'dark',
    }
  }, [preference, resolved])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
