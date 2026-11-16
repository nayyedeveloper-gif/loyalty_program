import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import Pagination from '../../components/Pagination'
import { useLanguage } from '../../context/LanguageContext'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import api, { getErrorMessage } from '../../lib/api'
import { faFloppyDisk, faPenToSquare, faPercent, faPlus, faTrash, faXmark } from '../../lib/icons'

const PRODUCT_TYPES = ['Gold', 'Diamond', 'Jade', 'Ruby', 'Silver', 'Watch', 'Other']

const emptyForm = {
  name: '',
  multiplier: '2',
  starts_at: '',
  ends_at: '',
  product_types: [],
  weekends_only: false,
  is_active: true,
}

function toLocalInput(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AdminPromotions() {
  const { t, lang } = useLanguage()
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function load(nextPage = 1, query = debouncedSearch) {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/promotions', {
        params: { search: query || undefined, page: nextPage, per_page: 20 },
      })
      setItems(data.promotions.data || [])
      setMeta(data.promotions)
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

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setMessage('')
    setModalOpen(true)
  }

  function openEdit(promo) {
    setEditing(promo)
    setForm({
      name: promo.name || '',
      multiplier: String(promo.multiplier ?? '2'),
      starts_at: toLocalInput(promo.starts_at),
      ends_at: toLocalInput(promo.ends_at),
      product_types: promo.product_types || [],
      weekends_only: !!promo.weekends_only,
      is_active: !!promo.is_active,
    })
    setError('')
    setMessage('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
  }

  function toggleProductType(type) {
    setForm((prev) => {
      const exists = prev.product_types.includes(type)
      return {
        ...prev,
        product_types: exists
          ? prev.product_types.filter((item) => item !== type)
          : [...prev.product_types, type],
      }
    })
  }

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    const payload = {
      name: form.name,
      multiplier: Number(form.multiplier),
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      product_types: form.product_types,
      weekends_only: !!form.weekends_only,
      is_active: !!form.is_active,
    }
    try {
      if (editing) {
        await api.put(`/admin/promotions/${editing.id}`, payload)
        setMessage(t('promoUpdated'))
      } else {
        await api.post('/admin/promotions', payload)
        setMessage(t('promoCreated'))
      }
      setModalOpen(false)
      await load(meta?.current_page || 1)
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotSavePromo')))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setError('')
    try {
      await api.delete(`/admin/promotions/${deleteTarget.id}`)
      setMessage(t('promoDeleted'))
      setDeleteTarget(null)
      await load(meta?.current_page || 1)
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotDeletePromo')))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        showBack
        title={t('promotions')}
        subtitle={t('promotionsCopy')}
        icon={faPercent}
        actions={(
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
            {t('addPromotion')}
          </button>
        )}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-ok" role="status">{message}</div>}

      <form
        className="filter-bar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          load(1, search.trim())
        }}
      >
        <label className="sr-only" htmlFor="promo-search">{t('search')}</label>
        <input
          id="promo-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPromosPlaceholder')}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-ghost">
          {t('search')}
        </button>
      </form>

      <div className="table-wrap is-stackable">
        <table className="data" aria-label={t('promotions')}>
          <thead>
            <tr>
              <th scope="col">{t('name')}</th>
              <th scope="col">{t('multiplier')}</th>
              <th scope="col">{t('period')}</th>
              <th scope="col">{t('status')}</th>
              <th scope="col">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="loading-state" role="status" aria-live="polite">
                  {t('loading')}
                </td>
              </tr>
            )}
            {!loading &&
              items.map((promo) => (
                <tr key={promo.id}>
                  <td data-label={t('name')}>
                    <div className="font-medium">{promo.name}</div>
                    <div className="type-meta text-[var(--color-muted)]">
                      {promo.weekends_only ? t('weekendsOnly') : t('allDays')}
                      {promo.product_types?.length
                        ? ` · ${promo.product_types.join(', ')}`
                        : ` · ${t('allProductTypes')}`}
                    </div>
                  </td>
                  <td data-label={t('multiplier')}>{Number(promo.multiplier)}×</td>
                  <td data-label={t('period')} className="type-meta">
                    {promo.starts_at
                      ? new Date(promo.starts_at).toLocaleString(lang === 'my' ? 'my-MM' : 'en-GB')
                      : '—'}
                    {' → '}
                    {promo.ends_at
                      ? new Date(promo.ends_at).toLocaleString(lang === 'my' ? 'my-MM' : 'en-GB')
                      : '—'}
                  </td>
                  <td data-label={t('status')}>{promo.is_active ? t('active') : t('inactive')}</td>
                  <td data-label={t('actions')}>
                    <div className="action-row">
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon-action"
                        onClick={() => openEdit(promo)}
                        aria-label={t('edit')}
                      >
                        <FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" />
                        <span className="btn-tooltip">{t('edit')}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-icon-action"
                        onClick={() => setDeleteTarget(promo)}
                        aria-label={t('delete')}
                      >
                        <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                        <span className="btn-tooltip">{t('delete')}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && !items.length && (
              <tr>
                <td colSpan={5} className="empty-state">
                  {t('noPromosFound')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} onPageChange={load} />

      <ConfirmModal
        open={!!deleteTarget}
        title={t('confirmDeleteTitle')}
        message={t('deletePromoConfirm', { name: deleteTarget?.name || '' })}
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <Modal open={modalOpen} onClose={closeModal} title={editing ? t('editPromotion') : t('addPromotion')}>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="field">
            <label htmlFor="promo-name">{t('name')}</label>
            <input
              id="promo-name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="promo-multiplier">{t('multiplier')}</label>
            <input
              id="promo-multiplier"
              type="number"
              min={1}
              max={10}
              step={0.1}
              required
              value={form.multiplier}
              onChange={(e) => setForm({ ...form, multiplier: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="field">
              <label htmlFor="promo-starts">{t('startsAt')}</label>
              <input
                id="promo-starts"
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="promo-ends">{t('endsAt')}</label>
              <input
                id="promo-ends"
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              />
            </div>
          </div>
          <fieldset className="field">
            <legend className="type-small font-medium mb-2">{t('productTypesOptional')}</legend>
            <div className="toolbar-row">
              {PRODUCT_TYPES.map((type) => (
                <label key={type} className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={form.product_types.includes(type)}
                    onChange={() => toggleProductType(type)}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={!!form.weekends_only}
              onChange={(e) => setForm({ ...form, weekends_only: e.target.checked })}
            />
            <span>
              <strong>{t('weekendsOnly')}</strong>
              <small>{t('weekendsOnlyCopy')}</small>
            </span>
          </label>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={!!form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <span>
              <strong>{t('active')}</strong>
              <small>{t('promoActiveCopy')}</small>
            </span>
          </label>
          <div className="action-row">
            <button type="button" className="btn btn-ghost" onClick={closeModal}>
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
