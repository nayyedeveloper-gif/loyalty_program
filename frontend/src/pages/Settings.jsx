import { useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAppSettings } from '../context/AppSettingsContext'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import ThemeSwitcher from '../components/ThemeSwitcher'
import api, { getErrorMessage } from '../lib/api'
import {
  faBuilding,
  faCamera,
  faEnvelope,
  faFloppyDisk,
  faGear,
  faIdBadge,
  faLock,
  faPhone,
  faShieldHalved,
  faTrash,
  faUser,
} from '../lib/icons'

export default function Settings() {
  const { section } = useParams()
  const { user, setUser, isAdmin } = useAuth()
  const { t, lang, setLang } = useLanguage()
  const { appName, appTagline, appLogoUrl, updateSettings, uploadLogo, removeLogo } = useAppSettings()
  const fileRef = useRef(null)
  const logoRef = useRef(null)
  const basePath = user?.role === 'admin' ? '/admin/settings' : '/app/settings'

  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
  })
  const [prefs, setPrefs] = useState({
    email_notifications: user?.preferences?.email_notifications ?? true,
    purchase_alerts: user?.preferences?.purchase_alerts ?? true,
  })
  const [appForm, setAppForm] = useState({
    app_name: appName,
    app_tagline: appTagline,
  })
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')

  useEffect(() => {
    setProfile({
      name: user?.name || '',
      phone: user?.phone || '',
      address: user?.address || '',
    })
    setPrefs({
      email_notifications: user?.preferences?.email_notifications ?? true,
      purchase_alerts: user?.preferences?.purchase_alerts ?? true,
    })
  }, [user])

  useEffect(() => {
    setAppForm({
      app_name: appName,
      app_tagline: appTagline,
    })
  }, [appName, appTagline])

  useEffect(() => {
    setError('')
    setMessage('')
  }, [section])

  if (section !== 'general' && section !== 'profile') {
    return <Navigate to={`${basePath}/general`} replace />
  }

  function syncUser(nextUser) {
    setUser(nextUser)
    localStorage.setItem('user', JSON.stringify(nextUser))
  }

  async function onSaveProfile(e) {
    e?.preventDefault?.()
    setBusy('profile')
    setError('')
    setMessage('')
    try {
      const { data } = await api.put('/settings/profile', {
        ...profile,
        preferences: prefs,
      })
      syncUser(data.user)
      setMessage(t('settingsSaved'))
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotSaveSettings')))
    } finally {
      setBusy('')
    }
  }

  async function onAvatarSelected(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy('avatar')
    setError('')
    setMessage('')
    try {
      const body = new FormData()
      body.append('avatar', file)
      const { data } = await api.upload('/settings/avatar', body)
      syncUser(data.user)
      setMessage(t('avatarUpdated'))
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotUpdateAvatar')))
    } finally {
      setBusy('')
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onRemoveAvatar() {
    setBusy('avatar')
    setError('')
    setMessage('')
    try {
      const { data } = await api.delete('/settings/avatar')
      syncUser(data.user)
      setMessage(t('avatarRemoved'))
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotUpdateAvatar')))
    } finally {
      setBusy('')
    }
  }

  async function onSaveApp(e) {
    e.preventDefault()
    setBusy('app')
    setError('')
    setMessage('')
    try {
      await updateSettings(appForm)
      setMessage(t('appSettingsSaved'))
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotSaveSettings')))
    } finally {
      setBusy('')
    }
  }

  async function onLogoSelected(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy('logo')
    setError('')
    setMessage('')
    try {
      await uploadLogo(file)
      setMessage(t('logoUpdated'))
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotUpdateLogo')))
    } finally {
      setBusy('')
      if (logoRef.current) logoRef.current.value = ''
    }
  }

  async function onRemoveLogo() {
    setBusy('logo')
    setError('')
    setMessage('')
    try {
      await removeLogo()
      setMessage(t('logoRemoved'))
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotUpdateLogo')))
    } finally {
      setBusy('')
    }
  }

  async function onChangePassword(e) {
    e.preventDefault()
    setBusy('password')
    setError('')
    setMessage('')
    try {
      const { data } = await api.post('/auth/change-password', passwordForm)
      if (data.user) syncUser(data.user)
      setPasswordForm({
        current_password: '',
        password: '',
        password_confirmation: '',
      })
      setMessage(t('passwordUpdated'))
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotUpdatePassword')))
    } finally {
      setBusy('')
    }
  }

  const initials = (user?.name || 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const pageTitle = section === 'profile' ? t('profile') : t('general')
  const pageSubtitle = section === 'profile' ? t('profileDetails') : t('settingsSubtitle')

  return (
    <div className="space-y-5 w-full">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <FontAwesomeIcon
              icon={section === 'profile' ? faUser : faGear}
              className="text-[var(--color-primary)]"
              aria-hidden="true"
            />
            {pageTitle}
          </h1>
          <p className="page-subtitle">{pageSubtitle}</p>
        </div>
      </header>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-ok" role="status" aria-live="polite">{message}</div>}

      <div className="settings-content card-panel">
        {section === 'general' && (
          <div className="settings-panel-body space-y-6">
            <section aria-labelledby="settings-theme-title">
              <div className="settings-row-head">
                <h2 id="settings-theme-title" className="settings-section-title">{t('theme')}</h2>
              </div>
              <ThemeSwitcher variant="cards" />
            </section>

            <section className="settings-divider-block" aria-labelledby="settings-language-title">
              <div className="settings-inline-row">
                <h2 id="settings-language-title" className="settings-section-title m-0">{t('language')}</h2>
                <label className="sr-only" htmlFor="settings-language-select">{t('language')}</label>
                <select
                  id="settings-language-select"
                  className="settings-select"
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                >
                  <option value="en">{t('english')}</option>
                  <option value="my">{t('burmese')}</option>
                </select>
              </div>
            </section>

            {isAdmin && (
              <section className="settings-divider-block space-y-3" aria-labelledby="settings-app-title">
                <h2 id="settings-app-title" className="settings-section-title flex items-center gap-2">
                  <FontAwesomeIcon icon={faBuilding} className="text-[var(--color-primary)]" aria-hidden="true" />
                  {t('appBranding')}
                </h2>
                <p className="page-subtitle m-0">{t('appBrandingCopy')}</p>
                <div className="space-y-3 max-w-xl">
                  <div className="space-y-2">
                    <h3 className="settings-section-title m-0">{t('appLogo')}</h3>
                    <p className="page-subtitle m-0">{t('appLogoCopy')}</p>
                    <div className="settings-avatar-row">
                      <div className="settings-logo-preview" aria-hidden="true">
                        <img src={appLogoUrl || '/brand/29-logo.png'} alt="" />
                      </div>
                      <div className="settings-avatar-actions">
                        <input
                          ref={logoRef}
                          id="settings-logo-input"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="sr-only"
                          onChange={onLogoSelected}
                        />
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busy === 'logo'}
                          onClick={() => logoRef.current?.click()}
                        >
                          <FontAwesomeIcon icon={faCamera} aria-hidden="true" />
                          {busy === 'logo' ? t('saving') : t('changeLogo')}
                        </button>
                        {appLogoUrl && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={busy === 'logo'}
                            onClick={onRemoveLogo}
                          >
                            <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                            {t('removeLogo')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <form onSubmit={onSaveApp} className="space-y-3 max-w-xl">
                  <div className="field">
                    <label htmlFor="settings-app-name">{t('appName')}</label>
                    <input
                      id="settings-app-name"
                      required
                      maxLength={80}
                      value={appForm.app_name}
                      onChange={(e) => setAppForm({ ...appForm, app_name: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="settings-app-tagline">{t('appTagline')}</label>
                    <input
                      id="settings-app-tagline"
                      maxLength={120}
                      value={appForm.app_tagline}
                      onChange={(e) => setAppForm({ ...appForm, app_tagline: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={busy === 'app'}>
                    <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
                    {busy === 'app' ? t('saving') : t('saveAppSettings')}
                  </button>
                </form>
              </section>
            )}
          </div>
        )}

        {section === 'profile' && (
          <div className="settings-panel-body space-y-6">
            <section className="space-y-4" aria-labelledby="settings-photo-title">
              <h2 id="settings-photo-title" className="settings-section-title flex items-center gap-2">
                <FontAwesomeIcon icon={faCamera} className="text-[var(--color-primary)]" aria-hidden="true" />
                {t('profilePhoto')}
              </h2>
              <p className="page-subtitle m-0">{t('profilePhotoCopy')}</p>
              <div className="settings-avatar-row">
                <div className="settings-avatar" aria-hidden="true">
                  {user?.avatar_url ? <img src={user.avatar_url} alt="" /> : <span>{initials}</span>}
                </div>
                <div className="settings-avatar-actions">
                  <input
                    ref={fileRef}
                    id="settings-avatar-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={onAvatarSelected}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy === 'avatar'}
                    onClick={() => fileRef.current?.click()}
                  >
                    <FontAwesomeIcon icon={faCamera} aria-hidden="true" />
                    {busy === 'avatar' ? t('saving') : t('changePhoto')}
                  </button>
                  {user?.avatar_url && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy === 'avatar'}
                      onClick={onRemoveAvatar}
                    >
                      <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                      {t('removePhoto')}
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="settings-divider-block space-y-3" aria-labelledby="settings-profile-title">
              <h2 id="settings-profile-title" className="settings-section-title flex items-center gap-2">
                <FontAwesomeIcon icon={faUser} className="text-[var(--color-primary)]" aria-hidden="true" />
                {t('profileDetails')}
              </h2>
              <form onSubmit={onSaveProfile} className="space-y-3 max-w-xl">
                <div className="field">
                  <label htmlFor="settings-email">
                    <FontAwesomeIcon icon={faEnvelope} className="field-icon" aria-hidden="true" /> {t('email')}
                  </label>
                  <input id="settings-email" value={user?.email || ''} disabled />
                </div>
                <div className="field">
                  <label htmlFor="settings-name">{t('displayName')}</label>
                  <input
                    id="settings-name"
                    autoComplete="name"
                    required
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="settings-phone">
                    <FontAwesomeIcon icon={faPhone} className="field-icon" aria-hidden="true" /> {t('phone')}
                  </label>
                  <input
                    id="settings-phone"
                    autoComplete="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="settings-address">{t('address')}</label>
                  <input
                    id="settings-address"
                    autoComplete="street-address"
                    value={profile.address}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  />
                </div>
                <dl className="settings-meta">
                  <div>
                    <dt>
                      <FontAwesomeIcon icon={faShieldHalved} className="field-icon" aria-hidden="true" /> {t('role')}
                    </dt>
                    <dd>{user?.role === 'admin' ? t('adminPortal') : t('memberApp')}</dd>
                  </div>
                  {user?.role === 'customer' && (
                    <div>
                      <dt>
                        <FontAwesomeIcon icon={faIdBadge} className="field-icon" aria-hidden="true" /> {t('customerId')}
                      </dt>
                      <dd>{user?.customer_code || '—'}</dd>
                    </div>
                  )}
                </dl>

                <div className="settings-toggles">
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={!!prefs.email_notifications}
                      onChange={(e) => setPrefs({ ...prefs, email_notifications: e.target.checked })}
                    />
                    <span>
                      <strong>{t('emailNotifications')}</strong>
                      <small>{t('emailNotificationsCopy')}</small>
                    </span>
                  </label>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={!!prefs.purchase_alerts}
                      onChange={(e) => setPrefs({ ...prefs, purchase_alerts: e.target.checked })}
                    />
                    <span>
                      <strong>{t('purchaseAlerts')}</strong>
                      <small>{t('purchaseAlertsCopy')}</small>
                    </span>
                  </label>
                </div>

                <button type="submit" className="btn btn-primary" disabled={busy === 'profile'}>
                  <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
                  {busy === 'profile' ? t('saving') : t('saveChanges')}
                </button>
              </form>
            </section>

            <section className="settings-divider-block space-y-3" aria-labelledby="settings-password-title">
              <h2 id="settings-password-title" className="settings-section-title flex items-center gap-2">
                <FontAwesomeIcon icon={faLock} className="text-[var(--color-primary)]" aria-hidden="true" />
                {t('changePassword')}
              </h2>
              <p className="page-subtitle m-0">{t('changePasswordCopy')}</p>
              <form onSubmit={onChangePassword} className="space-y-3 max-w-xl">
                <div className="field">
                  <label htmlFor="settings-current-password">{t('currentPassword')}</label>
                  <input
                    id="settings-current-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="settings-new-password">{t('newPassword')}</label>
                  <input
                    id="settings-new-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={passwordForm.password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="settings-confirm-password">{t('confirmPassword')}</label>
                  <input
                    id="settings-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={passwordForm.password_confirmation}
                    onChange={(e) => setPasswordForm({ ...passwordForm, password_confirmation: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={busy === 'password'}>
                  <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
                  {busy === 'password' ? t('saving') : t('updatePassword')}
                </button>
              </form>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
