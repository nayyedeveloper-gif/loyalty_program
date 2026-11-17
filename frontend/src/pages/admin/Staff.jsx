import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import Pagination from '../../components/Pagination'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import api, { getErrorMessage } from '../../lib/api'
import { faFloppyDisk, faPenToSquare, faPlus, faTrash, faUsers, faXmark } from '../../lib/icons'

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'staff',
}

export default function AdminStaff() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [roleFilter, setRoleFilter] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function load(nextPage = 1, query = debouncedSearch, nextRole = roleFilter) {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/staff', {
        params: {
          search: query || undefined,
          role: nextRole || undefined,
          page: nextPage,
          per_page: 20,
        },
      })
      setItems(data.staff.data || [])
      setMeta(data.staff)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1, debouncedSearch, roleFilter)
  }, [debouncedSearch, roleFilter])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setMessage('')
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      password: '',
      role: row.role === 'admin' ? 'admin' : 'staff',
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
      name: form.name,
      email: form.email,
      phone: form.phone,
      role: form.role,
      ...(form.password ? { password: form.password } : {}),
    }
    try {
      if (editing) {
        await api.put(`/admin/staff/${editing.id}`, payload)
        setMessage(t('staffUpdated'))
      } else {
        await api.post('/admin/staff', { ...payload, password: form.password })
        setMessage(t('staffCreated'))
      }
      setModalOpen(false)
      await load(meta?.current_page || 1)
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotSaveStaff')))
    } finally {
      setBusy(false)
    }
  }

  function requestDelete(row) {
    if (user?.id === row.id) {
      setError(t('cannotDeleteSelf'))
      return
    }
    setDeleteTarget(row)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setError('')
    try {
      await api.delete(`/admin/staff/${deleteTarget.id}`)
      setMessage(t('staffDeleted'))
      setDeleteTarget(null)
      await load(meta?.current_page || 1)
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotDeleteStaff')))
    } finally {
      setDeleting(false)
    }
  }

  function roleLabel(role) {
    if (role === 'admin') return t('roleAdmin')
    if (role === 'staff') return t('roleStaff')
    return role
  }

  return (
    <div className="space-y-5">
      <PageHeader
        showBack
        title={t('staffAccounts')}
        subtitle={t('staffAccountsCopy')}
        icon={faUsers}
        actions={(
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
            {t('addStaff')}
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
          load(1, search.trim(), roleFilter)
        }}
      >
        <label className="sr-only" htmlFor="staff-search">{t('search')}</label>
        <input
          id="staff-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchStaffPlaceholder')}
          autoComplete="off"
        />
        <label className="sr-only" htmlFor="staff-role-filter">{t('role')}</label>
        <select
          id="staff-role-filter"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">{t('allRoles')}</option>
          <option value="admin">{t('roleAdmin')}</option>
          <option value="staff">{t('roleStaff')}</option>
        </select>
        <button type="submit" className="btn btn-ghost">
          {t('search')}
        </button>
      </form>

      <div className="table-wrap is-stackable">
        <table className="data" aria-label={t('staffAccounts')}>
          <thead>
            <tr>
              <th scope="col">{t('name')}</th>
              <th scope="col">{t('email')}</th>
              <th scope="col">{t('phone')}</th>
              <th scope="col">{t('role')}</th>
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
              items.map((row) => {
                const isSelf = user?.id === row.id
                return (
                  <tr key={row.id}>
                    <td data-label={t('name')}>
                      {row.name}
                      {isSelf ? (
                        <span className="type-meta text-[var(--color-muted)]"> · {t('you')}</span>
                      ) : null}
                    </td>
                    <td data-label={t('email')}>{row.email}</td>
                    <td data-label={t('phone')}>{row.phone || '—'}</td>
                    <td data-label={t('role')}>
                      <span className={`tier-pill ${row.role === 'admin' ? 'tier-Gold' : 'tier-Silver'}`}>
                        {roleLabel(row.role)}
                      </span>
                    </td>
                    <td data-label={t('actions')}>
                      <div className="action-row">
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon-action"
                          onClick={() => openEdit(row)}
                          aria-label={t('edit')}
                        >
                          <FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" />
                          <span className="btn-tooltip">{t('edit')}</span>
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            className="btn btn-danger btn-icon-action"
                            onClick={() => requestDelete(row)}
                            aria-label={t('delete')}
                          >
                            <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                            <span className="btn-tooltip">{t('delete')}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            {!loading && !items.length && (
              <tr>
                <td colSpan={5} className="empty-state">
                  {t('noStaffFound')}
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
        message={t('deleteStaffConfirm', { name: deleteTarget?.name || '' })}
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('editStaff') : t('addStaff')}>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="field">
            <label htmlFor="staff-name">{t('name')}</label>
            <input
              id="staff-name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="staff-email">{t('email')}</label>
            <input
              id="staff-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="staff-phone">{t('phone')}</label>
            <input
              id="staff-phone"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="staff-role">{t('role')}</label>
            <select
              id="staff-role"
              required
              value={form.role}
              disabled={editing && user?.id === editing.id}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="staff">{t('roleStaff')}</option>
              <option value="admin">{t('roleAdmin')}</option>
            </select>
            <p className="type-meta text-[var(--color-muted)] m-0 mt-1">
              {form.role === 'admin' ? t('roleAdminHint') : t('roleStaffHint')}
            </p>
          </div>
          <div className="field">
            <label htmlFor="staff-password">{t('password')}</label>
            <input
              id="staff-password"
              type="password"
              required={!editing}
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editing ? t('passwordOptional') : undefined}
            />
          </div>
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
