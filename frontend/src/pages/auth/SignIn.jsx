import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import AuthLayout from '../../components/AuthLayout'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { getErrorMessage } from '../../lib/api'
import { faEnvelope, faLock, faRightToBracket } from '../../lib/icons'

export default function SignIn() {
  const { login } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = await login(form)
      if (user.role === 'admin') navigate('/admin')
      else if (user.role === 'staff') navigate('/admin/purchases')
      else navigate('/app')
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotSignIn')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t('signInSubtitle')}
      footer={
        <>
          {t('newMember')}{' '}
          <Link className="text-[var(--color-gold-deep)] font-medium" to="/signup">
            {t('createAccount')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <div className="field">
          <label htmlFor="email">
            <FontAwesomeIcon icon={faEnvelope} className="field-icon" aria-hidden="true" /> {t('email')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@email.com"
          />
        </div>
        <div className="field">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="password">
              <FontAwesomeIcon icon={faLock} className="field-icon" aria-hidden="true" /> {t('password')}
            </label>
            <Link to="/forgot-password" className="type-meta text-[var(--color-gold-deep)]">
              {t('forgotPassword')}
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
          />
        </div>
        <button className="btn btn-primary w-full" disabled={busy} type="submit">
          <FontAwesomeIcon icon={faRightToBracket} aria-hidden="true" />
          {busy ? t('signingIn') : t('signIn')}
        </button>
      </form>
    </AuthLayout>
  )
}
