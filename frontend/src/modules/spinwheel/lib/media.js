export function mediaUrl(path) {
  if (!path) return ''
  if (/^(?:https?:)?\/\//i.test(path) || /^(?:data|blob):/i.test(path)) return path
  if (path.startsWith('/')) return path
  return `/storage/${path}`
}
