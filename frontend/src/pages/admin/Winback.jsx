import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import PageHeader from '../../components/PageHeader'
import Pagination from '../../components/Pagination'
import { useLanguage } from '../../context/LanguageContext'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import api, { getErrorMessage } from '../../lib/api'
import { faGem, faUsers } from '../../lib/icons'

export default function AdminWinback() {
  const { t, lang } = useLanguage()
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [inactiveDays, setInactiveDays] = useState(180)
  const [defaultBonus, setDefaultBonus] = useState(50)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  async function load(nextPage = 1, query = debouncedSearch, nextInactiveDays = inactiveDays) {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/winback', {
        params: {
          search: query || undefined,
          inactive_days: nextInactiveDays || undefined,
          page: nextPage,
          per_page: 20,
        },
      })
      setItems(data.customers?.data || [])
      setMeta(data.customers)
      setInactiveDays(data.inactive_days || inactiveDays)
      setDefaultBonus(data.default_bonus || defaultBonus)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1, debouncedSearch, inactiveDays)
  }, [debouncedSearch, inactiveDays])

  async function grant(customer) {
    const points = window.prompt(t('winbackPointsPrompt'), String(defaultBonus))
    if (points === null) return
    const value = Number(points)
    if (!Number.isFinite(value) || value < 1) {
      setError(t('winbackPointsInvalid'))
      return
    }
    setBusyId(customer.id)
    setError('')
    setMessage('')
    try {
      await api.post('/admin/winback/grant', {
        user_id: customer.id,
        points: value,
        note: 'Win-back campaign',
      })
      setMessage(t('winbackGranted', { name: customer.name, points: value }))
      await load(meta?.current_page || 1)
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotGrantWinback')))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        showBack
        title={t('winbackCampaign')}
        subtitle={t('winbackCampaignCopy')}
        icon={faUsers}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-ok" role="status">{message}</div>}

      <form
        className="filter-bar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          load(1, search.trim(), inactiveDays)
        }}
      >
        <label className="sr-only" htmlFor="winback-search">{t('search')}</label>
        <input
          id="winback-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchCustomersPlaceholder')}
          autoComplete="off"
        />
        <label className="sr-only" htmlFor="winback-days">{t('inactiveDays')}</label>
        <input
          id="winback-days"
          type="number"
          min={30}
          value={inactiveDays}
          onChange={(e) => setInactiveDays(Number(e.target.value) || 180)}
          title={t('inactiveDays')}
        />
        <button type="submit" className="btn btn-ghost">{t('search')}</button>
      </form>

      <div className="table-wrap is-stackable">
        <table className="data" aria-label={t('winbackCampaign')}>
          <thead>
            <tr>
              <th scope="col">{t('customer')}</th>
              <th scope="col">{t('tier')}</th>
              <th scope="col">{t('lastActivity')}</th>
              <th scope="col">{t('inactiveDays')}</th>
              <th scope="col">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="loading-state" role="status" aria-live="polite">{t('loading')}</td>
              </tr>
            )}
            {!loading &&
              items.map((row) => (
                <tr key={row.id}>
                  <td data-label={t('customer')}>
                    <div className="font-medium">{row.name}</div>
                    <div className="type-meta text-[var(--color-muted)]">
                      {row.customer_code} · {row.phone}
                    </div>
                  </td>
                  <td data-label={t('tier')}>
                    <span className={`tier-pill tier-${row.tier}`}>{t(row.tier)}</span>
                  </td>
                  <td data-label={t('lastActivity')}>
                    {row.last_activity_at
                      ? new Date(row.last_activity_at).toLocaleDateString(lang === 'my' ? 'my-MM' : 'en-GB')
                      : t('never')}
                  </td>
                  <td data-label={t('inactiveDays')}>
                    {row.inactive_days != null ? Math.round(row.inactive_days) : '—'}
                  </td>
                  <td data-label={t('actions')}>
                    {row.recent_winback ? (
                      <span className="type-meta text-[var(--color-muted)]">{t('winbackAlreadyGranted')}</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyId === row.id}
                        onClick={() => grant(row)}
                      >
                        <FontAwesomeIcon icon={faGem} aria-hidden="true" />
                        {busyId === row.id ? t('saving') : t('grantWinback')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            {!loading && !items.length && (
              <tr>
                <td colSpan={5} className="empty-state">{t('noInactiveMembers')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} onPageChange={load} />
    </div>
  )
}
