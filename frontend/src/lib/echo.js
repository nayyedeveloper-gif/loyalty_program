import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

let echoInstance = null

function resolveHost() {
  const configured = import.meta.env.VITE_REVERB_HOST
  if (configured && configured !== 'localhost' && configured !== '127.0.0.1') {
    return configured
  }
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname
  }
  return configured || 'localhost'
}

export function getEcho() {
  return echoInstance
}

export function connectEcho(token) {
  if (!token) {
    disconnectEcho()
    return null
  }

  const key = import.meta.env.VITE_REVERB_APP_KEY
  if (!key) {
    return null
  }

  // Reuse the existing socket when already connected with the same auth token.
  if (echoInstance) {
    try {
      echoInstance.connector.pusher.config.auth.headers.Authorization = `Bearer ${token}`
    } catch {
      // ignore header refresh errors
    }
    return echoInstance
  }

  window.Pusher = Pusher

  const scheme = import.meta.env.VITE_REVERB_SCHEME || 'http'
  const port = Number(import.meta.env.VITE_REVERB_PORT || 8080)
  const forceTLS = scheme === 'https'

  echoInstance = new Echo({
    broadcaster: 'reverb',
    key,
    wsHost: resolveHost(),
    wsPort: port,
    wssPort: port,
    forceTLS,
    enabledTransports: ['ws', 'wss'],
    authEndpoint: '/api/broadcasting/auth',
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  })

  return echoInstance
}

export function disconnectEcho() {
  if (!echoInstance) return
  try {
    echoInstance.disconnect()
  } catch {
    // ignore disconnect errors
  }
  echoInstance = null
}
