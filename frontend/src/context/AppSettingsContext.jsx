import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import api from '../lib/api'

const AppSettingsContext = createContext(null)

const defaults = {
  app_name: '29 Jewellery',
  app_tagline: 'GEMS & JEWELLERY',
  app_logo: null,
  app_logo_url: null,
}

function normalizeSettings(raw = {}) {
  return {
    ...defaults,
    ...raw,
    app_logo_url: raw.app_logo_url || null,
  }
}

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      return normalizeSettings(JSON.parse(localStorage.getItem('appSettings') || 'null'))
    } catch {
      return { ...defaults }
    }
  })
  const [loading, setLoading] = useState(true)

  function persist(next) {
    const normalized = normalizeSettings(next)
    setSettings(normalized)
    localStorage.setItem('appSettings', JSON.stringify(normalized))
    return normalized
  }

  useEffect(() => {
    api
      .get('/settings/app')
      .then((res) => {
        persist(res.data.settings || {})
      })
      .catch(() => {
        // keep defaults / cached
      })
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo(() => {
    async function updateSettings(payload) {
      const { data } = await api.put('/admin/settings/app', payload)
      return persist(data.settings || {})
    }

    async function uploadLogo(file) {
      const body = new FormData()
      body.append('logo', file)
      const { data } = await api.upload('/admin/settings/logo', body)
      return persist(data.settings || {})
    }

    async function removeLogo() {
      const { data } = await api.delete('/admin/settings/logo')
      return persist(data.settings || {})
    }

    return {
      settings,
      loading,
      updateSettings,
      uploadLogo,
      removeLogo,
      appName: settings.app_name || defaults.app_name,
      appTagline: settings.app_tagline || defaults.app_tagline,
      appLogoUrl: settings.app_logo_url || null,
    }
  }, [settings, loading])

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext)
  if (!ctx) throw new Error('useAppSettings must be used within AppSettingsProvider')
  return ctx
}
