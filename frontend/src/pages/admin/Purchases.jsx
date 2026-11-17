import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ConfirmModal from '../../components/ConfirmModal'
import DateRangeFilter from '../../components/DateRangeFilter'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import Pagination from '../../components/Pagination'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import api, { downloadCsv, formatMMK, getErrorMessage } from '../../lib/api'
import PurchaseReceipt from '../../components/PurchaseReceipt'
import {
  faBan,
  faBoxOpen,
  faDownload,
  faFloppyDisk,
  faMagnifyingGlass,
  faPenToSquare,
  faPlus,
  faTrash,
  faXmark,
} from '../../lib/icons'

function normalizeMemberCode(raw) {
  const value = String(raw || '').trim()
  if (!value) return ''
  return value.replace(/^29G:/i, '').trim().toUpperCase()
}

const PRODUCT_TYPES = ['Gold', 'Diamond', 'Jade', 'Ruby', 'Silver', 'Watch', 'Other']
const PAYMENT_METHODS = ['Cash', 'Bank', 'KPay', 'WavePay', 'Visa/Master']

const emptyForm = {
  user_id: '',
  product_name: '',
  product_code: '',
  product_type: 'Gold',
  amount: '',
  points_to_redeem: '0',
  payment_method: 'Cash',
}

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `purchase-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function AdminPurchases() {
  const { isAdmin } = useAuth()
  const { t, lang } = useLanguage()
  const [purchases, setPurchases] = useState([])
  const [meta, setMeta] = useState(null)
  const [page, setPage] = useState(1)
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [memberCode, setMemberCode] = useState('')
  const [memberMatch, setMemberMatch] = useState(null)
  const [memberLookupError, setMemberLookupError] = useState('')
  const [receiptPurchase, setReceiptPurchase] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function loadPurchases(
    nextPage = page,
    query = debouncedSearch,
    nextDateFrom = dateFrom,
    nextDateTo = dateTo,
  ) {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/purchases', {
        params: {
          search: query || undefined,
          date_from: nextDateFrom || undefined,
          date_to: nextDateTo || undefined,
          page: nextPage,
          per_page: 20,
        },
      })
      setPurchases(data.purchases.data || [])
      setMeta(data.purchases)
      setPage(data.purchases.current_page || nextPage)
    } finally {
      setLoading(false)
    }
  }

  async function loadCustomers() {
    const { data } = await api.get('/admin/customers', { params: { search: '', per_page: 200 } })
    setCustomers(data.customers.data || [])
  }

  useEffect(() => {
    loadCustomers().catch((err) => {
      setError(getErrorMessage(err, t('somethingWrong')))
      setLoading(false)
    })
  }, [t])

  useEffect(() => {
    loadPurchases(1, debouncedSearch, dateFrom, dateTo).catch((err) => {
      setError(getErrorMessage(err, t('somethingWrong')))
      setLoading(false)
    })
  }, [debouncedSearch, dateFrom, dateTo])

  function resolveMemberCode(raw, nextUserId) {
    const code = normalizeMemberCode(raw)
    setMemberCode(raw)
    setMemberLookupError('')
    if (!code) {
      setMemberMatch(null)
      if (nextUserId !== undefined) {
        setForm((prev) => ({ ...prev, user_id: nextUserId }))
      }
      return
    }
    const match = customers.find(
      (c) => String(c.customer_code || '').toUpperCase() === code,
    )
    if (!match) {
      setMemberMatch(null)
      setMemberLookupError(t('memberNotFound'))
      return
    }
    setMemberMatch(match)
    setForm((prev) => ({ ...prev, user_id: String(match.id) }))
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setMemberCode('')
    setMemberMatch(null)
    setMemberLookupError('')
    setError('')
    setMessage('')
    setModalOpen(true)
  }

  function openEdit(purchase) {
    setEditing(purchase)
    setForm({
      user_id: String(purchase.user_id),
      product_name: purchase.product_name,
      product_code: purchase.product_code,
      product_type: purchase.product_type,
      amount: String(purchase.amount),
      points_to_redeem: String(purchase.points_redeemed || 0),
      payment_method: purchase.payment_method,
    })
    setMemberCode(purchase.user?.customer_code || '')
    setMemberMatch(purchase.user || null)
    setMemberLookupError('')
    setError('')
    setMessage('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
  }

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    const payload = {
      ...form,
      user_id: Number(form.user_id),
      amount: Number(form.amount),
      points_to_redeem: Number(form.points_to_redeem || 0),
    }
    try {
      if (editing) {
        const { data } = await api.put(`/admin/purchases/${editing.id}`, payload)
        setMessage(t('purchaseUpdated'))
        setReceiptPurchase(data.purchase)
      } else {
        const { data } = await api.post('/admin/purchases', payload, {
          headers: { 'Idempotency-Key': newIdempotencyKey() },
        })
        setMessage(t('purchaseRecorded'))
        setReceiptPurchase(data.purchase)
      }
      setModalOpen(false)
      await loadPurchases()
      await loadCustomers()
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setBusy(false)
    }
  }

  function openCancel(purchase) {
    setCancelTarget(purchase)
    setCancelReason('')
    setError('')
  }

  async function onCancelPurchase(e) {
    e.preventDefault()
    if (!cancelTarget) return
    setBusy(true)
    setError('')
    try {
      await api.post(`/admin/purchases/${cancelTarget.id}/cancel`, { reason: cancelReason })
      setMessage(t('purchaseCancelled'))
      setCancelTarget(null)
      setCancelReason('')
      await loadPurchases()
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotCancelPurchase')))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setError('')
    try {
      await api.delete(`/admin/purchases/${deleteTarget.id}`)
      setMessage(t('purchaseDeleted'))
      setDeleteTarget(null)
      await loadPurchases()
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setDeleting(false)
    }
  }

  async function onExport() {
    if (!isAdmin) return
    setExporting(true)
    setError('')
    try {
      await downloadCsv(
        '/admin/export/purchases',
        {
          search: search || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
        'purchases.csv',
      )
      setMessage(t('exportStarted'))
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotExport')))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        showBack
        title={t('purchases')}
        subtitle={t('purchasesSubtitle')}
        icon={faBoxOpen}
        actions={(
          <div className="action-row">
            {isAdmin && (
              <button type="button" className="btn btn-ghost" onClick={onExport} disabled={exporting}>
                <FontAwesomeIcon icon={faDownload} aria-hidden="true" />
                {exporting ? t('exporting') : t('exportCsv')}
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
              {t('recordPurchase')}
            </button>
          </div>
        )}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-ok" role="status" aria-live="polite">{message}</div>}

      <form
        className="filter-bar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          loadPurchases(1).catch((err) => setError(getErrorMessage(err, t('somethingWrong'))))
        }}
      >
        <label className="sr-only" htmlFor="purchase-search">{t('searchPurchases')}</label>
        <input
          id="purchase-search"
          placeholder={t('searchPurchases')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
        <button className="btn btn-ghost" type="submit">
          <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
          {t('search')}
        </button>
      </form>

      <div className="table-wrap is-stackable">
        <table className="data" aria-label={t('purchases')}>
          <thead>
            <tr>
              <th scope="col">{t('date')}</th>
              <th scope="col">{t('voucher')}</th>
              <th scope="col">{t('product')}</th>
              <th scope="col" className="hide-mobile">{t('type')}</th>
              <th scope="col">{t('customerId')}</th>
              <th scope="col">{t('customer')}</th>
              <th scope="col" className="hide-mobile">{t('branch')}</th>
              <th scope="col">{t('payable')}</th>
              <th scope="col">{t('pointsEarned')}</th>
              <th scope="col">{t('status')}</th>
              <th scope="col">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={11} className="loading-state" role="status" aria-live="polite">{t('loading')}</td>
              </tr>
            )}
            {!loading && purchases.map((p) => {
              const cancelled = p.status === 'cancelled'
              const when = p.sold_at || p.created_at
              return (
              <tr key={p.id}>
                <td data-label={t('date')} className="type-meta">
                  {when ? new Date(when).toLocaleDateString() : '—'}
                </td>
                <td data-label={t('voucher')} className="font-medium">{p.voucher_number || '—'}</td>
                <td data-label={t('product')}>
                  <div className="font-medium">{p.product_name}</div>
                  <div className="type-meta text-[var(--color-muted)]">{p.product_code}</div>
                </td>
                <td data-label={t('type')} className="hide-mobile">
                  {t(p.product_type) !== p.product_type ? t(p.product_type) : p.product_type}
                </td>
                <td data-label={t('customerId')} className="font-medium">{p.user?.customer_code || '—'}</td>
                <td data-label={t('customer')}>
                  <div>{p.user?.name}</div>
                  <div className="type-meta text-[var(--color-muted)]">{p.user?.phone || ''}</div>
                </td>
                <td data-label={t('branch')} className="hide-mobile type-meta">{p.branch_name || '—'}</td>
                <td data-label={t('payable')}>{formatMMK(p.net_amount)}</td>
                <td data-label={t('pointsEarned')}>{Number(p.points_earned || 0).toLocaleString()}</td>
                <td data-label={t('status')}>
                  {cancelled ? t('purchaseStatusCancelled') : t('purchaseStatusRecorded')}
                </td>
                <td data-label={t('actions')}>
                  <div className="action-row">
                    {!cancelled && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon-action"
                        onClick={() => openEdit(p)}
                        aria-label={t('edit')}
                      >
                        <FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" />
                        <span className="btn-tooltip">{t('edit')}</span>
                      </button>
                    )}
                    {!cancelled && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon-action"
                        onClick={() => openCancel(p)}
                        aria-label={t('cancelPurchase')}
                      >
                        <FontAwesomeIcon icon={faBan} aria-hidden="true" />
                        <span className="btn-tooltip">{t('cancelPurchase')}</span>
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        className="btn btn-danger btn-icon-action"
                        onClick={() => setDeleteTarget(p)}
                        aria-label={t('delete')}
                      >
                        <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                        <span className="btn-tooltip">{t('delete')}</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )})}
            {!loading && !purchases.length && (
              <tr>
                <td colSpan={11} className="empty-state">{t('noPurchasesFound')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} onPageChange={(next) => loadPurchases(next)} />

      <ConfirmModal
        open={!!deleteTarget}
        title={t('confirmDeleteTitle')}
        message={t('confirmDeletePurchase')}
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? t('editPurchase') : t('recordPurchase')}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="field">
            <label htmlFor="purchase-member-code">{t('memberLookup')}</label>
            <input
              id="purchase-member-code"
              value={memberCode}
              onChange={(e) => resolveMemberCode(e.target.value)}
              placeholder={t('memberLookupPlaceholder')}
              autoComplete="off"
            />
            <p className="type-meta text-[var(--color-muted)] m-0 mt-1">{t('memberLookupHint')}</p>
            {memberLookupError ? (
              <p className="type-meta text-rose-600 m-0 mt-1">{memberLookupError}</p>
            ) : null}
            {memberMatch ? (
              <p className="type-meta text-emerald-700 m-0 mt-1">
                {t('memberMatched', {
                  name: memberMatch.name,
                  tier: t(memberMatch.tier || 'Care'),
                  points: Number(memberMatch.redeemable_points || memberMatch.points || 0).toLocaleString(),
                })}
              </p>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="purchase-user_id">{t('customer')}</label>
            <select
              id="purchase-user_id"
              required
              value={form.user_id}
              onChange={(e) => {
                const id = e.target.value
                setForm({ ...form, user_id: id })
                const match = customers.find((c) => String(c.id) === id)
                setMemberMatch(match || null)
                setMemberCode(match?.customer_code || '')
                setMemberLookupError('')
              }}
            >
              <option value="">{t('selectCustomer')}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_code ? `${c.customer_code} · ` : ''}{c.name} · {t(c.tier)} · {Number(c.redeemable_points || c.points || 0).toLocaleString()} pts · {c.phone}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="purchase-product_name">{t('productName')}</label>
            <input
              id="purchase-product_name"
              required
              value={form.product_name}
              onChange={(e) => setForm({ ...form, product_name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="purchase-product_code">{t('productCode')}</label>
            <input
              id="purchase-product_code"
              required
              value={form.product_code}
              onChange={(e) => setForm({ ...form, product_code: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="field">
              <label htmlFor="purchase-product_type">{t('productType')}</label>
              <select
                id="purchase-product_type"
                value={form.product_type}
                onChange={(e) => setForm({ ...form, product_type: e.target.value })}
              >
                {PRODUCT_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="purchase-payment_method">{t('payment')}</label>
              <select
                id="purchase-payment_method"
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="purchase-amount">{t('amountMmk')}</label>
            <input
              id="purchase-amount"
              type="number"
              min={1000}
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="purchase-points-redeem">{t('pointsToRedeem')}</label>
            <input
              id="purchase-points-redeem"
              type="number"
              min={0}
              step={100}
              value={form.points_to_redeem}
              onChange={(e) => setForm({ ...form, points_to_redeem: e.target.value })}
            />
          </div>
          <p className="type-meta text-[var(--color-muted)]">{t('purchaseHint')}</p>
          <div className="flex justify-end gap-2 pt-2 flex-wrap">
            <button type="button" className="btn btn-ghost" onClick={closeModal}>
              <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
              {t('cancel')}
            </button>
            <button className="btn btn-primary" disabled={busy} type="submit">
              <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
              {busy ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!receiptPurchase}
        onClose={() => setReceiptPurchase(null)}
        title={t('purchaseSummary')}
      >
        <PurchaseReceipt purchase={receiptPurchase} />
      </Modal>

      <Modal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title={t('cancelPurchase')}
      >
        <form onSubmit={onCancelPurchase} className="space-y-3">
          <p className="type-small text-[var(--color-muted)] m-0">{t('cancelPurchaseCopy')}</p>
          <div className="field">
            <label htmlFor="cancel-reason">{t('cancelReason')}</label>
            <textarea
              id="cancel-reason"
              rows={3}
              required
              maxLength={255}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <div className="action-row">
            <button type="button" className="btn btn-ghost" onClick={() => setCancelTarget(null)}>
              <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
              {t('cancel')}
            </button>
            <button type="submit" className="btn btn-danger" disabled={busy}>
              <FontAwesomeIcon icon={faBan} aria-hidden="true" />
              {busy ? t('saving') : t('confirmCancelPurchase')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
