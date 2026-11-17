import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import Pagination from '../../components/Pagination'
import { useLanguage } from '../../context/LanguageContext'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import api, { getErrorMessage } from '../../lib/api'
import { faFloppyDisk, faPenToSquare, faPlus, faTrash, faTrophy, faXmark } from '../../lib/icons'

const GOAL_TYPES = ['purchase_count', 'spend_amount', 'login_days']

const emptyForm = {
  code: '',
  title: '',
  description: '',
  goal_type: 'purchase_count',
  goal_target: '1',
  bonus_points: '50',
  starts_at: '',
  ends_at: '',
  is_active: true,
}

function toLocalInput(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AdminMissions() {
  const { t } = useLanguage()
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
      const { data } = await api.get('/admin/missions', {
        params: { search: query || undefined, page: nextPage, per_page: 20 },
      })
      setItems(data.missions.data || [])
      setMeta(data.missions)
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

  function goalLabel(type) {
    if (type === 'purchase_count') return t('goalPurchaseCount')
    if (type === 'spend_amount') return t('goalSpendAmount')
    if (type === 'login_days') return t('goalLoginDays')
    return type
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setMessage('')
    setModalOpen(true)
  }

  function openEdit(mission) {
    setEditing(mission)
    setForm({
      code: mission.code || '',
      title: mission.title || '',
      description: mission.description || '',
      goal_type: mission.goal_type || 'purchase_count',
      goal_target: String(mission.goal_target ?? '1'),
      bonus_points: String(mission.bonus_points ?? '0'),
      starts_at: toLocalInput(mission.starts_at),
      ends_at: toLocalInput(mission.ends_at),
      is_active: !!mission.is_active,
    })
    setError('')
    setMessage('')
    setModalOpen(true)
  }

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    const payload = {
      code: form.code || undefined,
      title: form.title,
      description: form.description || null,
      goal_type: form.goal_type,
      goal_target: Number(form.goal_target),
      bonus_points: Number(form.bonus_points || 0),
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      is_active: !!form.is_active,
    }
    try {
      if (editing) {
        await api.put(`/admin/missions/${editing.id}`, payload)
        setMessage(t('missionUpdated'))
      } else {
        await api.post('/admin/missions', payload)
        setMessage(t('missionCreated'))
      }
      setModalOpen(false)
      await load(meta?.current_page || 1)
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotSaveMission')))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setError('')
    try {
      await api.delete(`/admin/missions/${deleteTarget.id}`)
      setMessage(t('missionDeleted'))
      setDeleteTarget(null)
      await load(meta?.current_page || 1)
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotDeleteMission')))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        showBack
        title={t('manageMissions')}
        subtitle={t('manageMissionsCopy')}
        icon={faTrophy}
        actions={(
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
            {t('addMission')}
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
        <label className="sr-only" htmlFor="mission-search">{t('search')}</label>
        <input
          id="mission-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchMissionsPlaceholder')}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-ghost">
          {t('search')}
        </button>
      </form>

      <div className="table-wrap is-stackable">
        <table className="data" aria-label={t('manageMissions')}>
          <thead>
            <tr>
              <th scope="col">{t('name')}</th>
              <th scope="col">{t('goal')}</th>
              <th scope="col">{t('bonus')}</th>
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
              items.map((mission) => (
                <tr key={mission.id}>
                  <td data-label={t('name')}>
                    <div className="font-medium">{mission.title}</div>
                    <div className="type-meta text-[var(--color-muted)]">{mission.code}</div>
                  </td>
                  <td data-label={t('goal')}>
                    {goalLabel(mission.goal_type)} · {Number(mission.goal_target).toLocaleString()}
                  </td>
                  <td data-label={t('bonus')}>+{Number(mission.bonus_points || 0).toLocaleString()}</td>
                  <td data-label={t('status')}>{mission.is_active ? t('active') : t('inactive')}</td>
                  <td data-label={t('actions')}>
                    <div className="action-row">
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon-action"
                        onClick={() => openEdit(mission)}
                        aria-label={t('edit')}
                      >
                        <FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" />
                        <span className="btn-tooltip">{t('edit')}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-icon-action"
                        onClick={() => setDeleteTarget(mission)}
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
                  {t('noMissionsFound')}
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
        message={t('deleteMissionConfirm', { title: deleteTarget?.title || '' })}
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('editMission') : t('addMission')}>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="field">
            <label htmlFor="mission-title">{t('name')}</label>
            <input
              id="mission-title"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="mission-code">{t('missionCode')}</label>
            <input
              id="mission-code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder={t('missionCodeAuto')}
            />
          </div>
          <div className="field">
            <label htmlFor="mission-description">{t('description')}</label>
            <textarea
              id="mission-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="field">
              <label htmlFor="mission-goal-type">{t('goal')}</label>
              <select
                id="mission-goal-type"
                value={form.goal_type}
                onChange={(e) => setForm({ ...form, goal_type: e.target.value })}
              >
                {GOAL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {goalLabel(type)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="mission-goal-target">{t('goalTarget')}</label>
              <input
                id="mission-goal-target"
                type="number"
                min={1}
                required
                value={form.goal_target}
                onChange={(e) => setForm({ ...form, goal_target: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="mission-bonus">{t('bonus')}</label>
            <input
              id="mission-bonus"
              type="number"
              min={0}
              value={form.bonus_points}
              onChange={(e) => setForm({ ...form, bonus_points: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="field">
              <label htmlFor="mission-starts">{t('startsAt')}</label>
              <input
                id="mission-starts"
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="mission-ends">{t('endsAt')}</label>
              <input
                id="mission-ends"
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              />
            </div>
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={!!form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <span>
              <strong>{t('active')}</strong>
              <small>{t('missionActiveCopy')}</small>
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
