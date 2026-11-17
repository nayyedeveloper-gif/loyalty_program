import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader'
import Pagination from '../../components/Pagination'
import { useLanguage } from '../../context/LanguageContext'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import api, { getErrorMessage } from '../../lib/api'
import { faUsers } from '../../lib/icons'

export default function AdminReferrals() {
  const { t, lang } = useLanguage()
  const [stats, setStats] = useState(null)
  const [top, setTop] = useState([])
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load(nextPage = 1, query = debouncedSearch) {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/referrals', {
        params: { search: query || undefined, page: nextPage, per_page: 20 },
      })
      setStats(data.stats || null)
      setTop(data.top_referrers || [])
      setItems(data.referrers?.data || [])
      setMeta(data.referrers)
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
        title={t('referralDashboard')}
        subtitle={t('referralDashboardCopy')}
        icon={faUsers}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {stats && (
        <div className="stat-grid">
          <section className="stat-card">
            <div className="meta-label">{t('totalReferred')}</div>
            <div className="stat-value mt-2">{Number(stats.total_referred || 0).toLocaleString()}</div>
          </section>
          <section className="stat-card">
            <div className="meta-label">{t('activeReferrers')}</div>
            <div className="stat-value mt-2">{Number(stats.active_referrers || 0).toLocaleString()}</div>
          </section>
          <section className="stat-card">
            <div className="meta-label">{t('referralBonusPaid')}</div>
            <div className="stat-value mt-2">{Number(stats.bonus_points_paid || 0).toLocaleString()}</div>
          </section>
        </div>
      )}

      {top.length > 0 && (
        <section className="stat-card">
          <h2 className="section-heading mb-3">{t('topReferrers')}</h2>
          <div className="space-y-2">
            {top.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] pb-2">
                <div>
                  <div className="font-medium">{row.name}</div>
                  <div className="type-meta text-[var(--color-muted)]">
                    {row.customer_code} · {row.referral_code}
                  </div>
                </div>
                <span className="font-semibold">{row.referrals_count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <form
        className="filter-bar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          load(1, search.trim())
        }}
      >
        <label className="sr-only" htmlFor="referral-search">{t('search')}</label>
        <input
          id="referral-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchCustomersPlaceholder')}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-ghost">{t('search')}</button>
      </form>

      <div className="table-wrap is-stackable">
        <table className="data" aria-label={t('referralDashboard')}>
          <thead>
            <tr>
              <th scope="col">{t('referrer')}</th>
              <th scope="col">{t('referralCode')}</th>
              <th scope="col">{t('invites')}</th>
              <th scope="col">{t('recentInvites')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="loading-state" role="status" aria-live="polite">{t('loading')}</td>
              </tr>
            )}
            {!loading &&
              items.map((row) => (
                <tr key={row.id}>
                  <td data-label={t('referrer')}>
                    <div className="font-medium">{row.name}</div>
                    <div className="type-meta text-[var(--color-muted)]">{row.customer_code || row.email}</div>
                  </td>
                  <td data-label={t('referralCode')}>{row.referral_code || '—'}</td>
                  <td data-label={t('invites')}>{row.referrals_count}</td>
                  <td data-label={t('recentInvites')}>
                    {(row.referrals || []).length
                      ? row.referrals
                          .map((r) => `${r.name} (${new Date(r.created_at).toLocaleDateString(lang === 'my' ? 'my-MM' : 'en-GB')})`)
                          .join(', ')
                      : '—'}
                  </td>
                </tr>
              ))}
            {!loading && !items.length && (
              <tr>
                <td colSpan={4} className="empty-state">{t('noReferralsYet')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} onPageChange={load} />
    </div>
  )
}
