import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { useLanguage } from '../context/LanguageContext'
import api, { getErrorMessage } from '../lib/api'
import { faCircleQuestion, faEnvelope, faEye, faPaperPlane } from '../lib/icons'

export default function HelpFeedback() {
  const { t, lang } = useLanguage()
  const [form, setForm] = useState({ subject: '', message: '' })
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  async function loadList() {
    setLoading(true)
    try {
      const { data } = await api.get('/customer/feedback', { params: { per_page: 50 } })
      setItems(data.feedback?.data || [])
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadList()
  }, [])

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

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { data } = await api.post('/customer/feedback', form)
      setMessage(t('helpFeedbackSent'))
      setForm({ subject: '', message: '' })
      setItems((prev) => [data.feedback, ...prev])
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotSendFeedback')))
    } finally {
      setBusy(false)
    }
  }

  async function openItem(item) {
    setReply('')
    setMessage('')
    setSelected(item)
    try {
      const { data } = await api.get(`/customer/feedback/${item.id}`)
      setSelected(data.feedback)
    } catch {
      // keep list item
    }
  }

  async function sendReply(e) {
    e.preventDefault()
    if (!selected || !reply.trim()) return
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post(`/customer/feedback/${selected.id}/replies`, {
        body: reply.trim(),
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

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        showBack
        title={t('helpFeedback')}
        subtitle={t('helpFeedbackCopy')}
        icon={faCircleQuestion}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && !selected && (
        <div className="alert alert-ok" role="status">
          {message}
        </div>
      )}

      <form onSubmit={onSubmit} className="stat-card space-y-3 max-w-xl">
        <div className="field">
          <label htmlFor="help-subject">{t('subject')}</label>
          <input
            id="help-subject"
            required
            maxLength={160}
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="help-message">{t('message')}</label>
          <textarea
            id="help-message"
            rows={6}
            required
            maxLength={5000}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          <FontAwesomeIcon icon={faEnvelope} aria-hidden="true" />
          {busy ? t('saving') : t('sendFeedback')}
        </button>
        <p className="type-meta text-[var(--color-muted)] m-0">{t('helpFeedbackHint')}</p>
      </form>

      <section className="space-y-3 max-w-xl" aria-labelledby="your-feedback-title">
        <div>
          <h2 id="your-feedback-title" className="section-heading">
            {t('yourFeedback')}
          </h2>
          <p className="type-small text-[var(--color-muted)] m-0">{t('yourFeedbackCopy')}</p>
        </div>

        {loading && (
          <div className="loading-state" role="status" aria-live="polite">
            {t('loading')}
          </div>
        )}

        {!loading && !items.length && (
          <div className="empty-state">{t('noFeedbackYet')}</div>
        )}

        {!loading &&
          items.map((item) => (
            <article key={item.id} className="stat-card feedback-list-item">
              <div className="feedback-list-copy">
                <div className="font-medium">{item.subject}</div>
                <div className="type-meta text-[var(--color-muted)]">
                  {formatWhen(item.created_at)} · {statusLabel(item.status)}
                </div>
                <p className="type-small m-0 line-clamp-2">{item.message}</p>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => openItem(item)}>
                <FontAwesomeIcon icon={faEye} aria-hidden="true" />
                {t('view')}
              </button>
            </article>
          ))}
      </section>

      <Modal
        open={!!selected}
        onClose={() => {
          setSelected(null)
          setReply('')
          setMessage('')
        }}
        title={selected?.subject || t('helpFeedback')}
        wide
      >
        {selected && (
          <div className="space-y-4">
            {message && (
              <div className="alert alert-ok" role="status">
                {message}
              </div>
            )}
            <div className="type-meta text-[var(--color-muted)]">
              {formatWhen(selected.created_at)} · {statusLabel(selected.status)}
            </div>

            <section className="feedback-thread" aria-label={t('conversation')}>
              <article className="feedback-bubble is-customer">
                <header>
                  <strong>{t('you')}</strong>
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
                    <strong>{item.from_staff ? t('staffTeam') : t('you')}</strong>
                    <span>{formatWhen(item.created_at)}</span>
                  </header>
                  <p>{item.body}</p>
                </article>
              ))}

              {!selected.replies?.length && (
                <p className="type-meta text-[var(--color-muted)] m-0">{t('noRepliesYet')}</p>
              )}
            </section>

            {selected.status !== 'resolved' ? (
              <form onSubmit={sendReply} className="space-y-3">
                <div className="field">
                  <label htmlFor="customer-feedback-reply">{t('message')}</label>
                  <textarea
                    id="customer-feedback-reply"
                    rows={3}
                    required
                    maxLength={5000}
                    value={reply}
                    placeholder={t('replyPlaceholder')}
                    onChange={(e) => setReply(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={busy || !reply.trim()}>
                  <FontAwesomeIcon icon={faPaperPlane} aria-hidden="true" />
                  {busy ? t('saving') : t('sendReply')}
                </button>
              </form>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  )
}
