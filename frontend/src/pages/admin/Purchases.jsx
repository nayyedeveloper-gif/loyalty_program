import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import { useLanguage } from '../../context/LanguageContext'
import api, { formatMMK, getErrorMessage } from '../../lib/api'
import {
  faBoxOpen,
  faFloppyDisk,
  faMagnifyingGlass,
  faPenToSquare,
  faPlus,
  faTrash,
  faXmark,
} from '../../lib/icons'

const PRODUCT_TYPES = ['Gold', 'Diamond', 'Jade', 'Ruby', 'Silver', 'Watch', 'Other']
const PAYMENT_METHODS = ['Cash', 'Bank', 'KPay', 'WavePay', 'Visa/Master']

const emptyForm = {
  user_id: '',
  product_name: '',
  product_code: '',
  product_type: 'Gold',
  amount: '',
  payment_method: 'Cash',
}

export default function AdminPurchases() {
  const { t } = useLanguage()
  const [purchases, setPurchases] = useState([])
  const [meta, setMeta] = useState(null)
  const [page, setPage] = useState(1)
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)

  async function loadPurchases(nextPage = page) {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/purchases', {
        params: {
          search: search || undefined,
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
    Promise.all([loadPurchases(1), loadCustomers()]).catch((err) => {
      setError(getErrorMessage(err, t('somethingWrong')))
      setLoading(false)
    })
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
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
      payment_method: purchase.payment_method,
    })
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
    }
    try {
      if (editing) {
        await api.put(`/admin/purchases/${editing.id}`, payload)
        setMessage(t('purchaseUpdated'))
      } else {
        await api.post('/admin/purchases', payload)
        setMessage(t('purchaseRecorded'))
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

  async function onDelete(purchase) {
    if (!confirm(t('confirmDeletePurchase'))) return
    try {
      await api.delete(`/admin/purchases/${purchase.id}`)
      setMessage(t('purchaseDeleted'))
      await loadPurchases()
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    }
  }

  return (
    <div className="space-y-5">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <FontAwesomeIcon icon={faBoxOpen} className="text-[var(--color-primary)]" aria-hidden="true" />
            {t('purchases')}
          </h1>
          <p className="page-subtitle">{t('purchasesSubtitle')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
          {t('recordPurchase')}
        </button>
      </header>

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
        <button className="btn btn-ghost" type="submit">
          <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
          {t('search')}
        </button>
      </form>

      <div className="table-wrap">
        <table className="data" aria-label={t('purchases')}>
          <thead>
            <tr>
              <th scope="col">{t('product')}</th>
              <th scope="col">{t('type')}</th>
              <th scope="col">{t('customerId')}</th>
              <th scope="col">{t('customer')}</th>
              <th scope="col">{t('amount')}</th>
              <th scope="col">{t('discount')}</th>
              <th scope="col">{t('net')}</th>
              <th scope="col">{t('payment')}</th>
              <th scope="col">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="loading-state" role="status" aria-live="polite">{t('loading')}</td>
              </tr>
            )}
            {!loading && purchases.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="font-medium">{p.product_name}</div>
                  <div className="text-xs text-[var(--color-muted)]">{p.product_code}</div>
                </td>
                <td>{t(p.product_type) !== p.product_type ? t(p.product_type) : p.product_type}</td>
                <td className="font-medium">{p.user?.customer_code || '—'}</td>
                <td>{p.user?.name}</td>
                <td>{formatMMK(p.amount)}</td>
                <td>{p.discount_percent}%</td>
                <td>{formatMMK(p.net_amount)}</td>
                <td>{p.payment_method}</td>
                <td>
                  <div className="action-row">
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon-action"
                      onClick={() => openEdit(p)}
                      aria-label={t('edit')}
                    >
                      <FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" />
                      <span className="btn-tooltip">{t('edit')}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-icon-action"
                      onClick={() => onDelete(p)}
                      aria-label={t('delete')}
                    >
                      <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                      <span className="btn-tooltip">{t('delete')}</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !purchases.length && (
              <tr>
                <td colSpan={9} className="empty-state">{t('noPurchasesFound')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} onPageChange={(next) => loadPurchases(next)} />

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? t('editPurchase') : t('recordPurchase')}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="field">
            <label htmlFor="purchase-user_id">{t('customer')}</label>
            <select
              id="purchase-user_id"
              required
              value={form.user_id}
              onChange={(e) => setForm({ ...form, user_id: e.target.value })}
            >
              <option value="">{t('selectCustomer')}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_code ? `${c.customer_code} · ` : ''}{c.name} · {t(c.tier)} · {c.phone}
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
          <p className="text-xs text-[var(--color-muted)]">{t('purchaseHint')}</p>
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
    </div>
  )
}
