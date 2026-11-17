import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import Pagination from '../../components/Pagination'
import { useLanguage } from '../../context/LanguageContext'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import api, { getErrorMessage } from '../../lib/api'
import { faEnvelopeOpenText, faEye, faPaperPlane } from '../../lib/icons'

const STATUSES = ['', 'new', 'read', 'in_progress', 'resolved']

export default function AdminFeedback() {
  const { t, lang } = useLanguage()
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)

  async function load(nextPage = 1, query = debouncedSearch, nextStatus = status) {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/feedback', {
        params: {
          search: query || undefined,
          status: nextStatus || undefined,
          page: nextPage,
          per_page: 20,
        },
      })
      setItems(data.feedback.data || [])
      setMeta(data.feedback)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1, debouncedSearch, status)
  }, [debouncedSearch, status])

  async function openItem(item) {
    setReply('')
    setMessage('')
    setSelected(item)
    try {
      const { data } = await api.get(`/admin/feedback/${item.id}`)
      let feedback = data.feedback
      if (feedback.status === 'new') {
        const updated = await api.put(`/admin/feedback/${item.id}`, { status: 'read' })
        feedback = updated.data.feedback
      }
      setSelected(feedback)
      setItems((prev) => prev.map((row) => (row.id === item.id ? feedback : row)))
    } catch {
      // keep list item if detail fetch fails
    }
  }

  async function updateStatus(nextStatus) {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      const { data } = await api.put(`/admin/feedback/${selected.id}`, { status: nextStatus })
      setSelected(data.feedback)
      setItems((prev) => prev.map((row) => (row.id === selected.id ? data.feedback : row)))
      setMessage(t('feedbackUpdated'))
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotUpdateFeedback')))
    } finally {
      setBusy(false)
    }
  }

  async function sendReply(e) {
    e.preventDefault()
    if (!selected || !reply.trim()) return
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post(`/admin/feedback/${selected.id}/replies`, {
        body: reply.trim(),
        status: selected.status === 'resolved' ? 'resolved' : 'in_progress',
      })
      setSelected(data.feedback)
      setItems((prev) => prev.map((row) => (row.id === selected.id ? data.feedback : row)))
      setReply('')
      setMessage(t('replySent'))
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotSendReply')))
    } finally {
      setBusy(false)
    }
  }

  function statusLabel(value) {
    if (value === 'new') return t('feedbackNew')
    if (value === 'read') return t('feedbackRead')
    if (value === 'in_progress') return t('feedbackInProgress')
    if (value === 'resolved') return t('feedbackResolved')
    return value
  }

  function formatWhen(value) {
    return new Date(value).toLocaleString(lang === 'my' ? 'my-MM' : 'en-GB')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        showBack
        title={t('customerFeedback')}
        subtitle={t('customerFeedbackCopy')}
        icon={faEnvelopeOpenText}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && !selected && (
        <div className="alert alert-ok" role="status">
          {message}
        </div>
      )}

      <form
        className="filter-bar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          load(1, search.trim(), status)
        }}
      >
        <label className="sr-only" htmlFor="feedback-search">{t('search')}</label>
        <input
          id="feedback-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchFeedbackPlaceholder')}
          autoComplete="off"
        />
        <label className="sr-only" htmlFor="feedback-status">{t('status')}</label>
        <select id="feedback-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('allStatuses')}</option>
          {STATUSES.filter(Boolean).map((item) => (
            <option key={item} value={item}>
              {statusLabel(item)}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-ghost">
          {t('search')}
        </button>
      </form>

      <div className="table-wrap is-stackable">
        <table className="data" aria-label={t('customerFeedback')}>
          <thead>
            <tr>
              <th scope="col">{t('date')}</th>
              <th scope="col">{t('customer')}</th>
              <th scope="col">{t('subject')}</th>
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
              items.map((item) => (
                <tr key={item.id}>
                  <td data-label={t('date')}>
                    {new Date(item.created_at).toLocaleDateString(lang === 'my' ? 'my-MM' : 'en-GB')}
                  </td>
                  <td data-label={t('customer')}>
                    <div className="font-medium">{item.user?.name || '—'}</div>
                    <div className="type-meta text-[var(--color-muted)]">
                      {item.user?.customer_code || item.user?.email || ''}
                    </div>
                  </td>
                  <td data-label={t('subject')}>
                    <div className="font-medium">{item.subject}</div>
                    <div className="type-meta text-[var(--color-muted)] line-clamp-1">{item.message}</div>
                  </td>
                  <td data-label={t('status')}>{statusLabel(item.status)}</td>
                  <td data-label={t('actions')}>
                    <button type="button" className="btn btn-ghost" onClick={() => openItem(item)}>
                      <FontAwesomeIcon icon={faEye} aria-hidden="true" />
                      {t('view')}
                    </button>
                  </td>
                </tr>
              ))}
            {!loading && !items.length && (
              <tr>
                <td colSpan={5} className="empty-state">{t('noFeedbackYet')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} onPageChange={load} />

      <Modal
        open={!!selected}
        onClose={() => {
          setSelected(null)
          setReply('')
          setMessage('')
        }}
        title={selected?.subject || t('customerFeedback')}
        wide
      >
        {selected && (
          <div className="space-y-4">
            {message && (
              <div className="alert alert-ok" role="status">
                {message}
              </div>
            )}
            <div className="type-small text-[var(--color-muted)]">
              {selected.user?.name}
              {selected.user?.customer_code ? ` · ${selected.user.customer_code}` : ''}
              {selected.user?.email ? ` · ${selected.user.email}` : ''}
            </div>
            <div className="type-meta text-[var(--color-muted)]">
              {formatWhen(selected.created_at)}
              {' · '}
              {statusLabel(selected.status)}
            </div>

            <section className="feedback-thread" aria-label={t('conversation')}>
              <article className="feedback-bubble is-customer">
                <header>
                  <strong>{selected.user?.name || t('customer')}</strong>
                  <span>{formatWhen(selected.created_at)}</span>
                </header>
                <p>{selected.message}</p>
              </article>

              {(selected.replies || []).map((item) => (
                <article
                  key={item.id}
                  className={`feedback-bubble ${item.from_staff ? 'is-staff' : 'is-customer'}`}
                >
                  <header>
                    <strong>
                      {item.from_staff ? t('staffTeam') : item.user?.name || t('customer')}
                    </strong>
                    <span>{formatWhen(item.created_at)}</span>
                  </header>
                  <p>{item.body}</p>
                </article>
              ))}
            </section>

            <form onSubmit={sendReply} className="space-y-3">
              <div className="field">
                <label htmlFor="admin-feedback-reply">{t('replyToCustomer')}</label>
                <textarea
                  id="admin-feedback-reply"
                  rows={4}
                  required
                  maxLength={5000}
                  value={reply}
                  placeholder={t('replyPlaceholder')}
                  onChange={(e) => setReply(e.target.value)}
                />
              </div>
              <div className="action-row">
                <button type="submit" className="btn btn-primary" disabled={busy || !reply.trim()}>
                  <FontAwesomeIcon icon={faPaperPlane} aria-hidden="true" />
                  {busy ? t('saving') : t('sendReply')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy || selected.status === 'in_progress'}
                  onClick={() => updateStatus('in_progress')}
                >
                  {t('markInProgress')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy || selected.status === 'resolved'}
                  onClick={() => updateStatus('resolved')}
                >
                  {t('markAsResolved')}
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  )
}
