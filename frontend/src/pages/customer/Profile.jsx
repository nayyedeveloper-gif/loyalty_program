import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import api, { getErrorMessage } from '../../lib/api'
import { faEnvelope, faFloppyDisk, faPhone, faUser } from '../../lib/icons'

export default function CustomerProfile() {
  const { user, setUser } = useAuth()
  const { t } = useLanguage()
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { data } = await api.put('/customer/profile', form)
      setUser(data.user)
      localStorage.setItem('user', JSON.stringify(data.user))
      setMessage(t('profileUpdated'))
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 w-full">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <FontAwesomeIcon icon={faUser} className="text-[var(--color-primary)]" aria-hidden="true" />
            {t('profile')}
          </h1>
          <p className="page-subtitle">{t('updateProfile')}</p>
        </div>
      </header>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-ok" role="status" aria-live="polite">{message}</div>}

      <form onSubmit={onSubmit} className="stat-card space-y-3 w-full max-w-3xl">
        <div className="field">
          <label htmlFor="profile-email">
            <FontAwesomeIcon icon={faEnvelope} className="field-icon" aria-hidden="true" /> {t('email')}
          </label>
          <input id="profile-email" value={user?.email || ''} disabled />
        </div>
        <div className="field">
          <label htmlFor="profile-name">
            <FontAwesomeIcon icon={faUser} className="field-icon" aria-hidden="true" /> {t('name')}
          </label>
          <input
            id="profile-name"
            autoComplete="name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="profile-phone">
            <FontAwesomeIcon icon={faPhone} className="field-icon" aria-hidden="true" /> {t('phone')}
          </label>
          <input
            id="profile-phone"
            autoComplete="tel"
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="profile-address">{t('address')}</label>
          <input
            id="profile-address"
            autoComplete="street-address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <button className="btn btn-primary" disabled={busy} type="submit">
          <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
          {busy ? t('saving') : t('saveChanges')}
        </button>
      </form>
    </div>
  )
}
