const API_BASE = '/api'

function buildUrl(path, params) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    })
  }
  return url.toString().replace(window.location.origin, '')
}

async function request(method, path, { params, body, headers } = {}) {
  const token = localStorage.getItem('token')
  const response = await fetch(buildUrl(path, params), {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      if (
        !pathName.startsWith('/signin') &&
        !pathName.startsWith('/signup') &&
        !pathName.startsWith('/forgot-password')
      ) {
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
