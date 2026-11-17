import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import Pagination from '../../components/Pagination'
import { useLanguage } from '../../context/LanguageContext'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import api, { getErrorMessage, mediaUrl } from '../../lib/api'
import { faCamera, faFloppyDisk, faPenToSquare, faPlus, faShoppingBag, faTrash, faXmark } from '../../lib/icons'

const emptyForm = {
  name: '',
  description: '',
  points_cost: '',
  stock: '',
  category: 'voucher',
  fulfillment: 'pickup',
  is_active: true,
}

const CATEGORIES = ['voucher', 'merchandise', 'partner']
const FULFILLMENTS = ['pickup', 'instant']

export default function AdminRewards() {
  const { t } = useLanguage()
  const imageRef = useRef(null)
  const [rewards, setRewards] = useState([])
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
  const [imageBusy, setImageBusy] = useState(false)
  const [pendingImage, setPendingImage] = useState(null)
  const [pendingPreview, setPendingPreview] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function load(nextPage = 1, query = debouncedSearch) {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/rewards', {
        params: {
          search: query || undefined,
          page: nextPage,
          per_page: 20,
        },
      })
      setRewards(data.rewards.data || [])
      setMeta(data.rewards)
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

  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    }
  }, [pendingPreview])

  function clearPendingImage() {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    setPendingImage(null)
    setPendingPreview('')
    if (imageRef.current) imageRef.current.value = ''
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    clearPendingImage()
    setError('')
    setMessage('')
    setModalOpen(true)
  }

  function openEdit(reward) {
    setEditing(reward)
    setForm({
      name: reward.name || '',
      description: reward.description || '',
      points_cost: String(reward.points_cost ?? ''),
      stock: reward.stock == null ? '' : String(reward.stock),
      category: reward.category || 'voucher',
      fulfillment: reward.fulfillment || (reward.category === 'partner' ? 'instant' : 'pickup'),
      is_active: !!reward.is_active,
    })
    clearPendingImage()
    setError('')
    setMessage('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    clearPendingImage()
  }

  function onPickImage(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (editing) {
      uploadImage(editing.id, file)
      return
    }

    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    setPendingImage(file)
    setPendingPreview(URL.createObjectURL(file))
  }

  async function uploadImage(rewardId, file) {
    setImageBusy(true)
    setError('')
    try {
      const body = new FormData()
      body.append('image', file)
      const { data } = await api.upload(`/admin/rewards/${rewardId}/image`, body)
      setEditing(data.reward)
      setRewards((prev) => prev.map((row) => (row.id === data.reward.id ? data.reward : row)))
      setMessage(t('rewardPhotoUpdated'))
      if (imageRef.current) imageRef.current.value = ''
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotUpdateRewardPhoto')))
    } finally {
      setImageBusy(false)
    }
  }

  async function removeImage() {
    if (!editing?.image_url) return
    setImageBusy(true)
    setError('')
    try {
      const { data } = await api.delete(`/admin/rewards/${editing.id}/image`)
      setEditing(data.reward)
      setRewards((prev) => prev.map((row) => (row.id === data.reward.id ? data.reward : row)))
      setMessage(t('rewardPhotoRemoved'))
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotRemoveRewardPhoto')))
    } finally {
      setImageBusy(false)
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    const payload = {
      name: form.name,
      description: form.description || null,
      points_cost: Number(form.points_cost),
      stock: form.stock === '' ? null : Number(form.stock),
      category: form.category,
      fulfillment: form.fulfillment,
      is_active: !!form.is_active,
    }
    try {
      if (editing) {
        await api.put(`/admin/rewards/${editing.id}`, payload)
        setMessage(t('rewardUpdated'))
      } else {
        const { data } = await api.post('/admin/rewards', payload)
        if (pendingImage && data.reward?.id) {
          const body = new FormData()
          body.append('image', pendingImage)
          await api.upload(`/admin/rewards/${data.reward.id}/image`, body)
        }
        setMessage(t('rewardCreated'))
      }
      closeModal()
      await load(meta?.current_page || 1)
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotSaveReward')))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setError('')
    try {
      await api.delete(`/admin/rewards/${deleteTarget.id}`)
      setMessage(t('rewardDeleted'))
      setDeleteTarget(null)
      await load(meta?.current_page || 1)
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotDeleteReward')))
    } finally {
      setDeleting(false)
    }
  }

  const previewUrl = pendingPreview || (editing?.image_url ? mediaUrl(editing.image_url) : '')

  return (
    <div className="space-y-5">
      <PageHeader
        showBack
        title={t('rewardsCatalog')}
        subtitle={t('adminRewardsCopy')}
        icon={faShoppingBag}
        actions={(
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
            {t('addReward')}
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
        <label className="sr-only" htmlFor="reward-search">{t('search')}</label>
        <input
          id="reward-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchRewardsPlaceholder')}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-ghost">
          {t('search')}
        </button>
      </form>

      <div className="table-wrap is-stackable">
        <table className="data" aria-label={t('rewardsCatalog')}>
          <thead>
            <tr>
              <th scope="col">{t('rewardPhoto')}</th>
              <th scope="col">{t('name')}</th>
              <th scope="col">{t('category')}</th>
              <th scope="col">{t('fulfillment')}</th>
              <th scope="col">{t('points')}</th>
              <th scope="col">{t('stock')}</th>
              <th scope="col">{t('status')}</th>
              <th scope="col">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="loading-state" role="status" aria-live="polite">{t('loading')}</td>
              </tr>
            )}
            {!loading &&
              rewards.map((reward) => (
                <tr key={reward.id}>
                  <td data-label={t('rewardPhoto')}>
                    <div className="reward-thumb" aria-hidden="true">
                      {reward.image_url ? (
                        <img src={mediaUrl(reward.image_url)} alt="" />
                      ) : (
                        <FontAwesomeIcon icon={faShoppingBag} />
                      )}
                    </div>
                  </td>
                  <td data-label={t('name')}>
                    <div className="font-medium">{reward.name}</div>
                    {reward.description ? (
                      <div className="type-meta text-[var(--color-muted)]">{reward.description}</div>
                    ) : null}
                  </td>
                  <td data-label={t('category')} className="capitalize">{reward.category || '—'}</td>
                  <td data-label={t('fulfillment')}>
                    {(reward.fulfillment || 'pickup') === 'instant' ? t('fulfillmentInstant') : t('fulfillmentPickup')}
                  </td>
                  <td data-label={t('points')}>{Number(reward.points_cost).toLocaleString()}</td>
                  <td data-label={t('stock')}>{reward.stock == null ? t('unlimited') : reward.stock}</td>
                  <td data-label={t('status')}>{reward.is_active ? t('active') : t('inactive')}</td>
                  <td data-label={t('actions')}>
                    <div className="action-row">
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon-action"
                        onClick={() => openEdit(reward)}
                        aria-label={t('edit')}
                      >
                        <FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" />
                        <span className="btn-tooltip">{t('edit')}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-icon-action"
                        onClick={() => setDeleteTarget(reward)}
                        aria-label={t('delete')}
                      >
                        <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                        <span className="btn-tooltip">{t('delete')}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && !rewards.length && (
              <tr>
                <td colSpan={8} className="empty-state">{t('noRewardsFound')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} onPageChange={load} />

      <ConfirmModal
        open={!!deleteTarget}
        title={t('confirmDeleteTitle')}
        message={t('deleteRewardConfirm', { name: deleteTarget?.name || '' })}
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <Modal open={modalOpen} onClose={closeModal} title={editing ? t('editReward') : t('addReward')}>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="field">
            <label htmlFor="reward-image-input">{t('rewardPhoto')}</label>
            <div className="settings-avatar-row">
              <div className="reward-photo-preview" aria-hidden="true">
                {previewUrl ? (
                  <img src={previewUrl} alt="" />
                ) : (
                  <FontAwesomeIcon icon={faShoppingBag} />
                )}
              </div>
              <div className="settings-avatar-actions">
                <input
                  ref={imageRef}
                  id="reward-image-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={onPickImage}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={imageBusy || busy}
                  onClick={() => imageRef.current?.click()}
                >
                  <FontAwesomeIcon icon={faCamera} aria-hidden="true" />
                  {imageBusy ? t('saving') : previewUrl ? t('changePhoto') : t('uploadPhoto')}
                </button>
                {editing?.image_url ? (
                  <button type="button" className="btn btn-ghost" disabled={imageBusy || busy} onClick={removeImage}>
                    {t('removePhoto')}
                  </button>
                ) : null}
                {!editing && pendingImage ? (
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={clearPendingImage}>
                    {t('removePhoto')}
                  </button>
                ) : null}
              </div>
            </div>
            <p className="type-meta text-[var(--color-muted)] m-0 mt-1">{t('rewardPhotoCopy')}</p>
          </div>
          <div className="field">
            <label htmlFor="reward-name">{t('name')}</label>
            <input
              id="reward-name"
              required
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="reward-description">{t('description')}</label>
            <textarea
              id="reward-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="reward-cost">{t('pointsCost')}</label>
            <input
              id="reward-cost"
              type="number"
              min={1}
              required
              value={form.points_cost}
              onChange={(e) => setForm({ ...form, points_cost: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="reward-stock">{t('stockOptional')}</label>
            <input
              id="reward-stock"
              type="number"
              min={0}
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              placeholder={t('unlimited')}
            />
          </div>
          <div className="field">
            <label htmlFor="reward-category">{t('category')}</label>
            <select
              id="reward-category"
              value={form.category}
              onChange={(e) => {
                const category = e.target.value
                setForm({
                  ...form,
                  category,
                  fulfillment: category === 'partner' ? 'instant' : form.fulfillment,
                })
              }}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="reward-fulfillment">{t('fulfillment')}</label>
            <select
              id="reward-fulfillment"
              value={form.fulfillment}
              onChange={(e) => setForm({ ...form, fulfillment: e.target.value })}
            >
              {FULFILLMENTS.map((mode) => (
                <option key={mode} value={mode}>
                  {mode === 'instant' ? t('fulfillmentInstant') : t('fulfillmentPickup')}
                </option>
              ))}
            </select>
            <p className="type-meta text-[var(--color-muted)] m-0 mt-1">{t('fulfillmentHint')}</p>
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={!!form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <span>
              <strong>{t('active')}</strong>
              <small>{t('rewardActiveCopy')}</small>
            </span>
          </label>
          <div className="action-row">
            <button type="button" className="btn btn-ghost" onClick={closeModal}>
              <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
              {t('cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || imageBusy}>
              <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
              {busy ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
