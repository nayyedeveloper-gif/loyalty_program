import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader'
import Pagination from '../../components/Pagination'
import { useLanguage } from '../../context/LanguageContext'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import api, { getErrorMessage } from '../../lib/api'
import { faClipboardList } from '../../lib/icons'

export default function AdminActivityLogs() {
  const { t, lang } = useLanguage()
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load(nextPage = 1, query = debouncedSearch) {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/activity-logs', {
        params: { search: query || undefined, page: nextPage, per_page: 30 },
      })
      setItems(data.logs.data || [])
      setMeta(data.logs)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1, debouncedSearch)
  }, [debouncedSearch])

  return (
    <div className="space-y-5">
      <PageHeader
        showBack
        title={t('activityLogs')}
        subtitle={t('activityLogsCopy')}
        icon={faClipboardList}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <form
        className="filter-bar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          load(1, search.trim())
        }}
      >
        <label className="sr-only" htmlFor="log-search">{t('search')}</label>
        <input
          id="log-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchActivityLogsPlaceholder')}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-ghost">
          {t('search')}
        </button>
      </form>

      <div className="table-wrap is-stackable">
        <table className="data" aria-label={t('activityLogs')}>
          <thead>
            <tr>
              <th scope="col">{t('date')}</th>
              <th scope="col">{t('actor')}</th>
              <th scope="col">{t('action')}</th>
              <th scope="col">{t('description')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="loading-state" role="status" aria-live="polite">
                  {t('loading')}
                </td>
              </tr>
            )}
            {!loading &&
              items.map((row) => (
                <tr key={row.id}>
                  <td data-label={t('date')}>
                    {new Date(row.created_at).toLocaleString(lang === 'my' ? 'my-MM' : 'en-GB')}
                  </td>
                  <td data-label={t('actor')}>
                    <div className="font-medium">{row.actor?.name || t('system')}</div>
                    <div className="type-meta text-[var(--color-muted)]">{row.actor?.role || ''}</div>
                  </td>
                  <td data-label={t('action')}>
                    <code className="type-meta">{row.action}</code>
                  </td>
                  <td data-label={t('description')}>{row.description}</td>
                </tr>
              ))}
            {!loading && !items.length && (
              <tr>
                <td colSpan={4} className="empty-state">
                  {t('noActivityLogs')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} onPageChange={load} />
    </div>
  )
}
