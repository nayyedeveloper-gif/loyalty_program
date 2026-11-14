import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import { useLanguage } from '../../context/LanguageContext'
import api, { formatMMK, getErrorMessage } from '../../lib/api'
import {
  faFloppyDisk,
  faMagnifyingGlass,
  faPenToSquare,
  faPlus,
  faTrash,
  faUsers,
  faXmark,
} from '../../lib/icons'

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  password: '',
}

export default function AdminCustomers() {
  const { t } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const [customers, setCustomers] = useState([])
  const [meta, setMeta] = useState(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [tier, setTier] = useState(searchParams.get('tier') || '')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const nextTier = searchParams.get('tier') || ''
    setTier(nextTier)
    setPage(1)
  }, [searchParams])

  async function load(nextPage = page) {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/customers', {
        params: {
          search: search || undefined,
          tier: tier || undefined,
          page: nextPage,
          per_page: 20,
        },
      })
      setCustomers(data.customers.data || [])
      setMeta(data.customers)
      setPage(data.customers.current_page || nextPage)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
  }, [tier])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setMessage('')
    setModalOpen(true)
  }

  function openEdit(customer) {
    setEditing(customer)
    setForm({
      name: customer.name,
      email: customer.email,
      phone: customer.phone || '',
      address: customer.address || '',
      password: '',
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
    try {
      if (editing) {
        const payload = { ...form }
        if (!payload.password) delete payload.password
        await api.put(`/admin/customers/${editing.id}`, payload)
        setMessage(t('customerUpdated'))
      } else {
        await api.post('/admin/customers', form)
        setMessage(t('customerCreated'))
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(customer) {
    if (!confirm(t('confirmDeleteCustomer', { name: customer.name }))) return
    try {
      await api.delete(`/admin/customers/${customer.id}`)
      setMessage(t('customerDeleted'))
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    }
  }

  const fieldLabels = {
    name: t('name'),
    email: t('email'),
    phone: t('phone'),
    address: t('address'),
  }

  return (
    <div className="space-y-5">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <FontAwesomeIcon icon={faUsers} className="text-[var(--color-primary)]" aria-hidden="true" />
            {t('customers')}
          </h1>
          <p className="page-subtitle">{t('manageMembers')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
          {t('addCustomer')}
        </button>
      </header>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-ok" role="status" aria-live="polite">{message}</div>}

      <form
        className="filter-bar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          load(1)
        }}
      >
        <label className="sr-only" htmlFor="customer-search">{t('searchCustomersPlaceholder')}</label>
        <input
          id="customer-search"
          placeholder={t('searchCustomersPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="sr-only" htmlFor="customer-tier">{t('tier')}</label>
        <select
          id="customer-tier"
          value={tier}
          onChange={(e) => {
            const value = e.target.value
            setTier(value)
            if (value) setSearchParams({ tier: value })
            else setSearchParams({})
          }}
        >
          <option value="">{t('allTiers')}</option>
          {['Silver', 'Gold', 'Platinum', 'Diamond'].map((tierName) => (
            <option key={tierName} value={tierName}>{t(tierName)}</option>
          ))}
        </select>
        <button className="btn btn-ghost" type="submit">
          <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
          {t('search')}
        </button>
      </form>

      <div className="table-wrap">
        <table className="data" aria-label={t('customers')}>
          <thead>
            <tr>
              <th scope="col">{t('customerId')}</th>
              <th scope="col">{t('name')}</th>
              <th scope="col">{t('phone')}</th>
              <th scope="col">{t('address')}</th>
              <th scope="col">{t('totalSpent')}</th>
              <th scope="col">{t('points')}</th>
              <th scope="col">{t('tier')}</th>
              <th scope="col">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="loading-state" role="status" aria-live="polite">{t('loading')}</td>
              </tr>
            )}
            {!loading && customers.map((c) => (
              <tr key={c.id}>
                <td className="font-medium text-[var(--color-ink)]">{c.customer_code || '—'}</td>
                <td>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-[var(--color-muted)]">{c.email}</div>
                </td>
                <td>{c.phone}</td>
                <td>{c.address || '—'}</td>
                <td>{formatMMK(c.total_spent)}</td>
                <td>{c.points.toLocaleString()}</td>
                <td><span className={`tier-pill tier-${c.tier}`}>{t(c.tier)}</span></td>
                <td>
                  <div className="action-row">
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon-action"
                      onClick={() => openEdit(c)}
                      aria-label={t('edit')}
                    >
                      <FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" />
                      <span className="btn-tooltip">{t('edit')}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-icon-action"
                      onClick={() => onDelete(c)}
                      aria-label={t('delete')}
                    >
                      <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                      <span className="btn-tooltip">{t('delete')}</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !customers.length && (
              <tr>
                <td colSpan={8} className="empty-state">{t('noCustomers')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} onPageChange={(next) => load(next)} />

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? t('editCustomer') : t('addCustomer')}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          {['name', 'email', 'phone', 'address'].map((key) => (
            <div className="field" key={key}>
              <label htmlFor={`customer-${key}`}>{fieldLabels[key]}</label>
              <input
                id={`customer-${key}`}
                required={key !== 'address'}
                type={key === 'email' ? 'email' : 'text'}
                autoComplete={key === 'email' ? 'email' : key === 'name' ? 'name' : key === 'phone' ? 'tel' : 'street-address'}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="field">
            <label htmlFor="customer-password">
              {editing ? t('passwordKeep') : t('password')}
            </label>
            <input
              id="customer-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required={!editing}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
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
