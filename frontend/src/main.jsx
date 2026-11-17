import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppSettingsProvider } from './context/AppSettingsContext'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { ChatProvider } from './context/ChatContext'
import { NotificationProvider } from './context/NotificationContext'
import { ThemeProvider } from './context/ThemeContext'
import { initNativeShell } from './mobile/capacitorApp'
import App from './App'
import './lib/icons'
import './index.css'

async function clearDevServiceWorkers() {
  if (!import.meta.env.DEV || !('serviceWorker' in navigator)) return
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((reg) => reg.unregister()))
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  } catch {
    // ignore — best-effort cleanup of stale Vite PWA workers
  }
}

async function registerProductionSW() {
  if (!import.meta.env.PROD) return
  try {
    const { registerSW } = await import('virtual:pwa-register')
    registerSW({ immediate: true })
  } catch {
    // PWA optional — app must still boot if registration fails
  }
}

void clearDevServiceWorkers().then(registerProductionSW)
initNativeShell()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <AppSettingsProvider>
            <AuthProvider>
              <NotificationProvider>
                <ChatProvider>
                  <App />
                </ChatProvider>
              </NotificationProvider>
            </AuthProvider>
          </AppSettingsProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
