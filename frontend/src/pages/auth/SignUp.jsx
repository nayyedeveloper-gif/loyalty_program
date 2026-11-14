import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import AuthLayout from '../../components/AuthLayout'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { getErrorMessage } from '../../lib/api'
import { faEnvelope, faLock, faPhone, faUser, faUserPlus } from '../../lib/icons'

export default function SignUp() {
  const { register } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    password_confirmation: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await register(form)
      navigate('/app')
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotCreate')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t('joinClub')}
      subtitle={t('signUpSubtitle')}
      footer={
        <>
          {t('alreadyMember')}{' '}
          <Link className="text-[var(--color-gold-deep)] font-medium" to="/signin">
            {t('signIn')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3.5">
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <div className="field">
          <label htmlFor="name">
            <FontAwesomeIcon icon={faUser} className="field-icon" /> {t('fullName')}
          </label>
          <input
            id="name"
            autoComplete="name"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="email">
            <FontAwesomeIcon icon={faEnvelope} className="field-icon" aria-hidden="true" /> {t('email')}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="phone">
            <FontAwesomeIcon icon={faPhone} className="field-icon" aria-hidden="true" /> {t('phone')}
          </label>
          <input
            id="phone"
            required
            autoComplete="tel"
            inputMode="tel"
            placeholder="09xxxxxxxxx"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">
            <FontAwesomeIcon icon={faLock} className="field-icon" /> {t('password')}
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password_confirmation">
            <FontAwesomeIcon icon={faLock} className="field-icon" /> {t('confirmPassword')}
          </label>
          <input
            id="password_confirmation"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password_confirmation}
            onChange={(e) => set('password_confirmation', e.target.value)}
          />
        </div>
        <button className="btn btn-primary w-full mt-2" disabled={busy} type="submit">
          <FontAwesomeIcon icon={faUserPlus} />
          {busy ? t('creating') : t('createAccount')}
        </button>
      </form>
    </AuthLayout>
  )
}
