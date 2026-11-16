import { useLanguage } from '../context/LanguageContext'

export default function Pagination({ meta, onPageChange }) {
  const { t } = useLanguage()

  if (!meta || !meta.last_page || meta.last_page <= 1) {
    if (!meta?.total) return null
    return (
      <div className="pagination-bar" aria-live="polite">
        <span className="type-small text-[var(--color-muted)]">
          {t('showingCount', {
            from: meta.from || 0,
            to: meta.to || 0,
            total: meta.total || 0,
          })}
        </span>
      </div>
    )
  }

  return (
    <nav className="pagination-bar" aria-label={t('pagination')}>
      <span className="type-small text-[var(--color-muted)]" aria-live="polite">
        {t('showingCount', {
          from: meta.from || 0,
          to: meta.to || 0,
          total: meta.total || 0,
        })}
      </span>
      <div className="pagination-actions">
        <button
          type="button"
          className="btn btn-ghost px-3 py-1"
          disabled={meta.current_page <= 1}
          onClick={() => onPageChange(meta.current_page - 1)}
          aria-label={t('previous')}
        >
          <span className="hide-mobile">{t('previous')}</span>
          <span className="show-mobile" aria-hidden="true">
            ‹
          </span>
        </button>
        <span className="type-small" aria-current="page">
          {t('pageOf', { page: meta.current_page, total: meta.last_page })}
        </span>
        <button
          type="button"
          className="btn btn-ghost px-3 py-1"
          disabled={meta.current_page >= meta.last_page}
          onClick={() => onPageChange(meta.current_page + 1)}
          aria-label={t('next')}
        >
          <span className="hide-mobile">{t('next')}</span>
          <span className="show-mobile" aria-hidden="true">
            ›
          </span>
        </button>
      </div>
    </nav>
  )
}
