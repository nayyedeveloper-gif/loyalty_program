import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import DateRangeFilter from '../../components/DateRangeFilter'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import Pagination from '../../components/Pagination'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import api, { downloadCsv, getErrorMessage } from '../../lib/api'
import { faDownload, faFloppyDisk, faGem, faPlus, faXmark } from '../../lib/icons'

const TYPES = ['', 'earn', 'redeem', 'adjust', 'bonus', 'expire', 'reverse']

const emptyAdjust = {
  user_id: '',
  points: '',
  reason: '',
  tier_eligible: false,
}

export default function AdminLedger() {
  const { isAdmin } = useAuth()
  const { t, lang } = useLanguage()
  const [entries, setEntries] = useState([])
  const [meta, setMeta] = useState(null)
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [type, setType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyAdjust)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function loadCustomers() {
    try {
      const { data } = await api.get('/admin/customers', { params: { per_page: 100 } })
      setCustomers(data.customers.data || [])
    } catch {
      // ignore picker load errors; adjust form still accepts typed id via select empty
    }
  }

  async function load(
    nextPage = 1,
    query = debouncedSearch,
    nextType = type,
    nextDateFrom = dateFrom,
    nextDateTo = dateTo,
  ) {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/ledger', {
        params: {
          search: query || undefined,
          type: nextType || undefined,
          date_from: nextDateFrom || undefined,
          date_to: nextDateTo || undefined,
          page: nextPage,
          per_page: 20,
        },
      })
      setEntries(data.ledger.data || [])
      setMeta(data.ledger)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    load(1, debouncedSearch, type, dateFrom, dateTo)
  }, [debouncedSearch, type, dateFrom, dateTo])

  function openAdjust() {
    setForm(emptyAdjust)
    setError('')
    setMessage('')
    setModalOpen(true)
  }

  async function onExport() {
    if (!isAdmin) return
    setExporting(true)
    setError('')
    try {
      await downloadCsv(
        '/admin/export/ledger',
        {
          search: search || undefined,
          type: type || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
        'ledger.csv',
      )
      setMessage(t('exportStarted'))
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotExport')))
    } finally {
      setExporting(false)
    }
  }

  async function onAdjust(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api.post('/admin/ledger/adjust', {
        user_id: Number(form.user_id),
        points: Number(form.points),
        reason: form.reason,
        tier_eligible: !!form.tier_eligible,
      })
      setMessage(t('pointsAdjusted'))
      setModalOpen(false)
      await load(1)
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotAdjustPoints')))
    } finally {
      setBusy(false)
    }
  }

  function reasonText(row) {
    const metaInfo = row.meta || {}
    if (metaInfo.reason) return metaInfo.reason
    if (metaInfo.reward_name) return metaInfo.reward_name
    if (row.source === 'purchase') return t('redeemSourcePurchase')
    if (row.source === 'catalog') return t('redeemSourceCatalog')
    return row.source
  }

  return (
    <div className="space-y-5">
      <PageHeader
        showBack
        title={t('pointsLedger')}
        subtitle={t('pointsLedgerCopy')}
        icon={faGem}
        actions={isAdmin ? (
          <div className="action-row">
            <button type="button" className="btn btn-ghost" onClick={onExport} disabled={exporting}>
              <FontAwesomeIcon icon={faDownload} aria-hidden="true" />
              {exporting ? t('exporting') : t('exportCsv')}
            </button>
            <button type="button" className="btn btn-primary" onClick={openAdjust}>
              <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
              {t('adjustPoints')}
            </button>
          </div>
        ) : null}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-ok" role="status">{message}</div>}

      <form
        className="filter-bar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          load(1, search.trim(), type, dateFrom, dateTo)
        }}
      >
        <label className="sr-only" htmlFor="ledger-search">{t('search')}</label>
        <input
          id="ledger-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchCustomersPlaceholder')}
          autoComplete="off"
        />
        <label className="sr-only" htmlFor="ledger-type">{t('type')}</label>
        <select id="ledger-type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t('allTypes')}</option>
          {TYPES.filter(Boolean).map((item) => (
            <option key={item} value={item}>
              {item}
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
        <table className="data" aria-label={t('pointsLedger')}>
          <thead>
            <tr>
              <th scope="col">{t('date')}</th>
              <th scope="col">{t('customer')}</th>
              <th scope="col">{t('type')}</th>
              <th scope="col">{t('source')}</th>
              <th scope="col">{t('details')}</th>
              <th scope="col">{t('points')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="loading-state" role="status" aria-live="polite">{t('loading')}</td>
              </tr>
            )}
            {!loading &&
              entries.map((row) => (
                <tr key={row.id}>
                  <td data-label={t('date')}>
                    {new Date(row.created_at).toLocaleDateString(lang === 'my' ? 'my-MM' : 'en-GB')}
                  </td>
                  <td data-label={t('customer')}>
                    <div className="font-medium">{row.user?.name || '—'}</div>
                    <div className="type-meta text-[var(--color-muted)]">
                      {row.user?.customer_code || row.user?.email || ''}
                    </div>
                  </td>
                  <td data-label={t('type')} className="capitalize">{row.type}</td>
                  <td data-label={t('source')} className="capitalize">{row.source}</td>
                  <td data-label={t('details')}>{reasonText(row)}</td>
                  <td
                    data-label={t('points')}
                    className={row.points >= 0 ? 'text-emerald-600' : 'text-rose-600'}
                  >
                    {row.points >= 0 ? '+' : ''}
                    {Number(row.points).toLocaleString()}
                  </td>
                </tr>
              ))}
            {!loading && !entries.length && (
              <tr>
                <td colSpan={6} className="empty-state">{t('noLedgerEntries')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} onPageChange={load} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('adjustPoints')}>
        <form onSubmit={onAdjust} className="space-y-3">
          <p className="page-subtitle m-0">{t('adjustPointsCopy')}</p>
          <div className="field">
            <label htmlFor="adjust-customer">{t('customer')}</label>
            <select
              id="adjust-customer"
              required
              value={form.user_id}
              onChange={(e) => setForm({ ...form, user_id: e.target.value })}
            >
              <option value="">{t('selectCustomer')}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_code ? `${c.customer_code} · ` : ''}
                  {c.name} · {Number(c.redeemable_points ?? c.points ?? 0).toLocaleString()} pts
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="adjust-points">{t('points')}</label>
            <input
              id="adjust-points"
              type="number"
              required
              value={form.points}
              onChange={(e) => setForm({ ...form, points: e.target.value })}
              placeholder={t('adjustPointsPlaceholder')}
            />
            <small className="field-hint">{t('adjustPointsHint')}</small>
          </div>
          <div className="field">
            <label htmlFor="adjust-reason">{t('reason')}</label>
            <input
              id="adjust-reason"
              required
              maxLength={255}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder={t('adjustReasonPlaceholder')}
            />
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={!!form.tier_eligible}
              onChange={(e) => setForm({ ...form, tier_eligible: e.target.checked })}
            />
            <span>
              <strong>{t('countTowardTier')}</strong>
              <small>{t('countTowardTierCopy')}</small>
            </span>
          </label>
          <div className="action-row">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
              {t('cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
              {busy ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
