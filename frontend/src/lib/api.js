const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')
const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || '').replace(/\/$/, '')

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(value)
}

function buildUrl(path, params) {
  const url = isAbsoluteUrl(API_BASE)
    ? new URL(`${API_BASE}${path}`)
    : new URL(`${API_BASE}${path}`, window.location.origin)

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    })
  }

  if (isAbsoluteUrl(API_BASE)) {
    return url.toString()
  }

  return url.toString().replace(window.location.origin, '')
}

/** Resolve relative /storage and /api media paths for native Capacitor builds. */
export function mediaUrl(path) {
  if (!path) return ''
  if (isAbsoluteUrl(path) || path.startsWith('blob:') || path.startsWith('data:')) {
    return path
  }
  if (API_ORIGIN) {
    return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
  }
  return path
}

function shouldAttachAuth(path) {
  // Guest spin APIs are session-token based; never send a portal Bearer token
  // (admin/staff tokens trigger unrelated 403s in shared-browser testing).
  return !String(path || '').startsWith('/spinwheel/guest')
}

function isPublicAuthPath(pathname) {
  return (
    pathname.startsWith('/signin')
    || pathname.startsWith('/signup')
    || pathname.startsWith('/forgot-password')
    || pathname.startsWith('/guest/')
  )
}

async function request(method, path, { params, body, headers } = {}) {
  const token = localStorage.getItem('token')
  const response = await fetch(buildUrl(path, params), {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token && shouldAttachAuth(path) ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let data = null
  const text = await response.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text }
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      const pathName = window.location.pathname
      if (!isPublicAuthPath(pathName)) {
        window.location.href = '/signin'
      }
    }

    const error = new Error(data?.message || `Request failed (${response.status})`)
    error.response = { status: response.status, data }
    throw error
  }

  return { data, status: response.status }
}

async function upload(path, formData) {
  const token = localStorage.getItem('token')
  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  })

  let data = null
  const text = await response.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text }
    }
  }

  if (!response.ok) {
    const error = new Error(data?.message || `Request failed (${response.status})`)
    error.response = { status: response.status, data }
    throw error
  }

  return { data, status: response.status }
}

const api = {
  get: (path, config = {}) => request('GET', path, { params: config.params, headers: config.headers }),
  post: (path, body, config = {}) => request('POST', path, { body, params: config.params, headers: config.headers }),
  put: (path, body, config = {}) => request('PUT', path, { body, params: config.params, headers: config.headers }),
  patch: (path, body, config = {}) => request('PATCH', path, { body, params: config.params, headers: config.headers }),
  delete: (path, config = {}) => request('DELETE', path, { params: config.params, headers: config.headers }),
  upload,
}

export default api

export function formatMMK(value) {
  const lang = localStorage.getItem('lang') === 'my' ? 'my-MM' : 'en-MM'
  const suffix = lang.startsWith('my') ? ' ကျပ်' : ' MMK'
  return new Intl.NumberFormat(lang).format(Number(value || 0)) + suffix
}

export function getErrorMessage(error, fallback = 'Something went wrong.') {
  return (
    error?.response?.data?.message ||
    Object.values(error?.response?.data?.errors || {})?.[0]?.[0] ||
    error?.message ||
    fallback
  )
}

export async function downloadCsv(path, params = {}, fallbackName = 'export.csv') {
  const token = localStorage.getItem('token')
  const response = await fetch(buildUrl(path, params), {
    method: 'GET',
    headers: {
      Accept: 'text/csv',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!response.ok) {
    let message = `Export failed (${response.status})`
    try {
      const data = await response.json()
      message = data?.message || message
    } catch {
      // ignore non-json error bodies
    }
    const error = new Error(message)
    error.response = { status: response.status }
    throw error
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i)
  const filename = match ? match[1].replace(/['"]/g, '') : fallbackName
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
