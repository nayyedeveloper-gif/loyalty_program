import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import PageHeader from '../components/PageHeader'
import { faCircleQuestion, faEnvelope, faFloppyDisk } from '../lib/icons'

export default function HelpFeedback() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [form, setForm] = useState({ subject: '', message: '' })
  const [sent, setSent] = useState(false)
  const homePath = user?.role === 'admin' ? '/admin' : '/app'
  const backLabel = user?.role === 'admin' ? t('backToDashboard') : t('backToMembership')

  function onSubmit(e) {
    e.preventDefault()
    const subject = encodeURIComponent(form.subject || t('helpFeedback'))
    const body = encodeURIComponent(form.message)
    window.location.href = `mailto:support@29gold.com?subject=${subject}&body=${body}`
    setSent(true)
  }

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title={t('helpFeedback')}
        subtitle={t('helpFeedbackCopy')}
        icon={faCircleQuestion}
        backTo={homePath}
        backLabel={backLabel}
      />

      {sent && (
        <div className="alert alert-ok" role="status">
          {t('helpFeedbackSent')}
        </div>
      )}

      <form onSubmit={onSubmit} className="stat-card space-y-3 max-w-xl">
        <div className="field">
          <label htmlFor="help-subject">{t('subject')}</label>
          <input
            id="help-subject"
            required
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
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </div>
        <button type="submit" className="btn btn-primary">
          <FontAwesomeIcon icon={faEnvelope} aria-hidden="true" />
          {t('sendFeedback')}
        </button>
        <p className="type-meta text-[var(--color-muted)] m-0 flex items-center gap-2">
          <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
          {t('helpFeedbackHint')}
        </p>
      </form>
    </div>
  )
}
