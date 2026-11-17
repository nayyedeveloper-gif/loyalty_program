import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import DateRangeFilter from '../../components/DateRangeFilter'
import PageHeader from '../../components/PageHeader'
import Pagination from '../../components/Pagination'
import { useLanguage } from '../../context/LanguageContext'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import api, { getErrorMessage } from '../../lib/api'
import { faShoppingBag } from '../../lib/icons'

const STATUSES = ['', 'pending', 'collected', 'cancelled']

export default function AdminRedemptions() {
  const { t, lang } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  async function load(
    nextPage = 1,
    query = debouncedSearch,
    nextStatus = status,
    nextDateFrom = dateFrom,
    nextDateTo = dateTo,
  ) {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/redemptions', {
        params: {
          search: query || undefined,
          status: nextStatus || undefined,
          date_from: nextDateFrom || undefined,
          date_to: nextDateTo || undefined,
          page: nextPage,
          per_page: 20,
        },
      })
      setItems(data.redemptions.data || [])
      setMeta(data.redemptions)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const next = searchParams.get('status') || ''
    setStatus(next)
  }, [searchParams])

  useEffect(() => {
    load(1, debouncedSearch, status, dateFrom, dateTo)
  }, [debouncedSearch, status, dateFrom, dateTo])

  function isInstant(item) {
    const reward = item?.reward_item
    return (reward?.fulfillment || (reward?.category === 'partner' ? 'instant' : 'pickup')) === 'instant'
  }

  function statusLabel(item) {
    const value = typeof item === 'string' ? item : item?.status
    if (value === 'pending') return t('redemptionPending')
    if (value === 'collected') {
      return typeof item === 'object' && isInstant(item) ? t('redemptionDelivered') : t('redemptionCollected')
    }
    if (value === 'cancelled') return t('redemptionCancelled')
    return value
  }

  async function setRedemptionStatus(item, nextStatus) {
    setBusyId(item.id)
    setError('')
    try {
      const { data } = await api.put(`/admin/redemptions/${item.id}`, { status: nextStatus })
      setItems((prev) => prev.map((row) => (row.id === item.id ? data.redemption : row)))
      setMessage(t('redemptionUpdated'))
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotUpdateRedemption')))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        showBack
        title={t('rewardRedemptions')}
        subtitle={t('rewardRedemptionsCopy')}
        icon={faShoppingBag}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-ok" role="status">{message}</div>}

      <form
        className="filter-bar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          load(1, search.trim(), status, dateFrom, dateTo)
        }}
      >
        <label className="sr-only" htmlFor="redemption-search">{t('search')}</label>
        <input
          id="redemption-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchRedemptionsPlaceholder')}
        />
        <label className="sr-only" htmlFor="redemption-status">{t('status')}</label>
        <select
          id="redemption-status"
          value={status}
          onChange={(e) => {
            const value = e.target.value
            setStatus(value)
            if (value) setSearchParams({ status: value })
            else setSearchParams({})
          }}
        >
          <option value="">{t('allStatuses')}</option>
              {STATUSES.filter(Boolean).map((item) => (
            <option key={item} value={item}>
              {item === 'pending'
                ? t('redemptionPending')
                : item === 'collected'
                  ? t('redemptionCollected')
                  : t('redemptionCancelled')}
            </option>
          ))}
        </select>
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          t={t}
          lang={lang}
          onChange={({ dateFrom: nextFrom, dateTo: nextTo }) => {
            setDateFrom(nextFrom)
            setDateTo(nextTo)
          }}
        />
        <button type="submit" className="btn btn-ghost">
          {t('search')}
        </button>
      </form>

      <div className="table-wrap is-stackable">
        <table className="data" aria-label={t('rewardRedemptions')}>
          <thead>
            <tr>
              <th scope="col">{t('date')}</th>
              <th scope="col">{t('redemptionCode')}</th>
              <th scope="col">{t('customer')}</th>
              <th scope="col">{t('reward')}</th>
              <th scope="col">{t('points')}</th>
              <th scope="col">{t('status')}</th>
              <th scope="col" className="col-actions">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="loading-state" role="status" aria-live="polite">
                  {t('loading')}
                </td>
              </tr>
            )}
            {!loading &&
              items.map((item) => (
                <tr key={item.id}>
                  <td data-label={t('date')}>
                    {new Date(item.created_at).toLocaleDateString(lang === 'my' ? 'my-MM' : 'en-GB')}
                  </td>
                  <td data-label={t('redemptionCode')}>
                    <div className="font-medium tracking-wide">{item.redemption_code || '—'}</div>
                  </td>
                  <td data-label={t('customer')}>
                    <div className="font-medium">{item.user?.name || '—'}</div>
                    <div className="type-meta text-[var(--color-muted)]">
                      {item.user?.customer_code || item.user?.email || ''}
                    </div>
                  </td>
                  <td data-label={t('reward')}>{item.reward_item?.name || '—'}</td>
                  <td data-label={t('points')}>{Number(item.points_spent || 0).toLocaleString()}</td>
                  <td data-label={t('status')}>{statusLabel(item)}</td>
                  <td data-label={t('actions')} className="col-actions">
                    <div className="action-row">
                      {item.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={busyId === item.id}
                            onClick={() => setRedemptionStatus(item, 'collected')}
                          >
                            {t('markCollected')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={busyId === item.id}
                            onClick={() => setRedemptionStatus(item, 'cancelled')}
                          >
                            {t('cancel')}
                          </button>
                        </>
                      ) : item.status === 'collected' && !isInstant(item) ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busyId === item.id}
                          onClick={() => setRedemptionStatus(item, 'pending')}
                        >
                          {t('reopenRedemption')}
                        </button>
                      ) : (
                        <span className="action-placeholder" aria-hidden="true">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && !items.length && (
              <tr>
                <td colSpan={7} className="empty-state">
                  {t('noRedemptionsFound')}
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
