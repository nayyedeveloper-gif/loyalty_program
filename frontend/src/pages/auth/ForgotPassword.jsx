import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import AuthLayout from '../../components/AuthLayout'
import { useLanguage } from '../../context/LanguageContext'
import api, { getErrorMessage } from '../../lib/api'
import { faEnvelope, faKey, faLock, faShieldHalved } from '../../lib/icons'

const STEPS = ['email', 'otp', 'reset']

export default function ForgotPassword() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [debugOtp, setDebugOtp] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendOtp(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { data } = await api.post('/auth/forgot-password', { email })
      setMessage(data.message)
      if (data.debug_otp) setDebugOtp(data.debug_otp)
      setStep('otp')
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setBusy(false)
    }
  }

  async function verifyOtp(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post('/auth/verify-otp', { email, otp })
      setMessage(data.message)
      setStep('reset')
    } catch (err) {
      setError(getErrorMessage(err, t('invalidOtp')))
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.post('/auth/reset-password', {
        email,
        otp,
        password,
        password_confirmation: passwordConfirmation,
      })
      navigate('/signin')
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotReset')))
    } finally {
      setBusy(false)
    }
  }

  const titles = {
    email: t('forgotTitle'),
    otp: t('enterOtp'),
    reset: t('newPassword'),
  }

  return (
    <AuthLayout
      title={titles[step]}
      subtitle={t('forgotSubtitle')}
      footer={
        <Link className="text-[var(--color-gold-deep)] font-medium" to="/signin">
          {t('backToSignIn')}
        </Link>
      }
    >
      <div
        className="mb-4 flex gap-2"
        role="group"
        aria-label={t('stepOf', { step: STEPS.indexOf(step) + 1, total: STEPS.length })}
      >
        {STEPS.map((s) => (
          <div
            key={s}
            aria-hidden="true"
            className={`h-1 flex-1 rounded-full ${step === s || STEPS.indexOf(step) > STEPS.indexOf(s) ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-line)]'}`}
          />
        ))}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {t('stepOf', { step: STEPS.indexOf(step) + 1, total: STEPS.length })}
      </p>

      {error && <div className="alert alert-error mb-3" role="alert">{error}</div>}
      {message && <div className="alert alert-ok mb-3" role="status" aria-live="polite">{message}</div>}
      {debugOtp && (
        <div className="alert alert-info mb-3" role="status" aria-live="polite">
          {t('localOtp')}: <strong>{debugOtp}</strong>
        </div>
      )}

      {step === 'email' && (
        <form onSubmit={sendOtp} className="space-y-4">
          <div className="field">
            <label htmlFor="email">
              <FontAwesomeIcon icon={faEnvelope} className="field-icon" /> {t('email')}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button className="btn btn-primary w-full" disabled={busy} type="submit">
            <FontAwesomeIcon icon={faEnvelope} />
            {busy ? t('sending') : t('sendOtp')}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={verifyOtp} className="space-y-4">
          <div className="field">
            <label htmlFor="otp">
              <FontAwesomeIcon icon={faShieldHalved} className="field-icon" /> {t('otpLabel')}
            </label>
            <input
              id="otp"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
            />
          </div>
          <button className="btn btn-primary w-full" disabled={busy} type="submit">
            <FontAwesomeIcon icon={faKey} />
            {busy ? t('verifying') : t('verifyOtp')}
          </button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={resetPassword} className="space-y-4">
          <div className="field">
            <label htmlFor="password">
              <FontAwesomeIcon icon={faLock} className="field-icon" /> {t('newPassword')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password_confirmation">
              <FontAwesomeIcon icon={faLock} className="field-icon" /> {t('confirmPassword')}
            </label>
            <input
              id="password_confirmation"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
            />
          </div>
          <button className="btn btn-primary w-full" disabled={busy} type="submit">
            <FontAwesomeIcon icon={faKey} />
            {busy ? t('saving') : t('resetPassword')}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
