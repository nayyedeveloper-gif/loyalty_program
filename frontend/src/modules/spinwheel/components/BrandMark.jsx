import { mediaUrl } from '../lib/media'

function initialsFrom(title, fallback = 'SW') {
  const text = (title || '').trim()
  if (!text) return fallback
  const parts = text.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase() || fallback
}

/** Shared header brand: admin-managed logo + title. */
export default function BrandMark({
  title,
  logoUrl,
  subtitle,
  centered = false,
  className = '',
  fallbackInitials = 'SW',
}) {
  const displayTitle = (title || '').trim() || 'Spin Wheel'
  const src = mediaUrl(logoUrl)
  const initials = initialsFrom(displayTitle, fallbackInitials)

  const mark = src ? (
    <img className="cx-logo cx-logo-img" src={src} alt="" />
  ) : (
    <div className="cx-logo" aria-hidden>{initials}</div>
  )

  if (centered) {
    return (
      <div className={`brand-mark brand-mark--centered ${className}`.trim()}>
        <div style={{ margin: '0 auto 0.85rem', width: 'fit-content' }}>{mark}</div>
        <h1 className="cx-title" style={{ fontSize: '2.5rem', margin: 0 }}>{displayTitle}</h1>
        {subtitle && <p className="cx-copy" style={{ marginTop: 8 }}>{subtitle}</p>}
      </div>
    )
  }

  return (
    <div className={`cx-brand ${className}`.trim()}>
      {mark}
      <div>
        <h1>{displayTitle}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </div>
  )
}
