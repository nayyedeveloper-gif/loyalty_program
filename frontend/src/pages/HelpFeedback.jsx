import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLanguage } from '../context/LanguageContext'
import PageHeader from '../components/PageHeader'
import api, { getErrorMessage } from '../lib/api'
import { faCircleQuestion, faEnvelope } from '../lib/icons'

export default function HelpFeedback() {
  const { t } = useLanguage()
  const [form, setForm] = useState({ subject: '', message: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api.post('/customer/feedback', form)
      setMessage(t('helpFeedbackSent'))
      setForm({ subject: '', message: '' })
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotSendFeedback')))
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
      {message && (
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
    </div>
  )
}
