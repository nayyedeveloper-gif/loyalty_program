import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAppSettings } from '../context/AppSettingsContext'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import ThemeSwitcher from '../components/ThemeSwitcher'
import api, { getErrorMessage } from '../lib/api'
import {
  faBuilding,
  faCamera,
  faChevronLeft,
  faChevronRight,
  faCircleInfo,
  faCircleQuestion,
  faFloppyDisk,
  faGear,
  faLock,
  faPenToSquare,
  faPhone,
  faRightFromBracket,
  faShieldHalved,
  faSun,
  faTrash,
  faUser,
} from '../lib/icons'

const DETAIL_SECTIONS = ['profile', 'appearance', 'language', 'password', 'about', 'branding']

function SettingsRow({ icon, label, hint, onClick, to, danger = false, showChevron = true }) {
  const className = `settings-list-row ${danger ? 'is-danger' : ''}`
  const content = (
    <>
      <span className="settings-list-icon" aria-hidden="true">
        <FontAwesomeIcon icon={icon} />
      </span>
      <span className="settings-list-copy">
        <span className="settings-list-label">{label}</span>
        {hint ? <span className="settings-list-hint">{hint}</span> : null}
      </span>
      {showChevron ? <FontAwesomeIcon icon={faChevronRight} className="settings-list-chevron" aria-hidden="true" /> : null}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  )
}

export default function Settings() {
  const { section } = useParams()
  const navigate = useNavigate()
  const { user, setUser, isAdmin, logout } = useAuth()
  const { t, lang, setLang } = useLanguage()
  const { appName, appTagline, appLogoUrl, updateSettings, uploadLogo, removeLogo } = useAppSettings()
  const fileRef = useRef(null)
  const logoRef = useRef(null)
  const avatarMenuRef = useRef(null)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const basePath = user?.role === 'admin' ? '/admin/settings' : '/app/settings'
  const helpPath = user?.role === 'admin' ? '/admin/help' : '/app/help'

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
    setAvatarMenuOpen(false)
  }, [section])

  useEffect(() => {
    if (!avatarMenuOpen) return undefined
    function onPointerDown(e) {
      if (!avatarMenuRef.current?.contains(e.target)) setAvatarMenuOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setAvatarMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [avatarMenuOpen])

  const allowed = ['general', ...DETAIL_SECTIONS]
  if (!allowed.includes(section) || (section === 'branding' && !isAdmin)) {
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

  async function onLogout() {
    await logout()
    navigate('/signin')
  }

  const initials = (user?.name || 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  function DetailShell({ title, children }) {
    return (
      <div className="space-y-5 w-full settings-hub">
        <header className="settings-hub-header">
          <button
            type="button"
            className="settings-hub-back"
            onClick={() => navigate(`${basePath}/general`)}
            aria-label={t('backToSettings')}
          >
            <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
          </button>
          <h1 className="settings-hub-title">{title}</h1>
          <span className="settings-hub-spacer" aria-hidden="true" />
        </header>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {message && <div className="alert alert-ok" role="status" aria-live="polite">{message}</div>}
        <div className="settings-detail-body">{children}</div>
      </div>
    )
  }

  const homePath = isAdmin ? '/admin' : '/app'
  const homeBackLabel = isAdmin ? t('backToDashboard') : t('backToMembership')

  if (section === 'general') {
    return (
      <div className="space-y-5 w-full settings-hub">
        <header className="settings-hub-header">
          <Link to={homePath} className="settings-hub-back" aria-label={homeBackLabel}>
            <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
          </Link>
          <h1 className="settings-hub-title">{t('settings')}</h1>
          <Link to={`${basePath}/profile`} className="settings-hub-edit">
            {t('edit')}
          </Link>
        </header>

        <section className="settings-list-card" aria-label={t('account')}>
          <SettingsRow
            icon={faUser}
            label={t('profileDetails')}
            hint={user?.name}
            to={`${basePath}/profile`}
          />
          <SettingsRow
            icon={faPhone}
            label={t('phone')}
            hint={user?.phone || t('notSet')}
            to={`${basePath}/profile`}
          />
          <SettingsRow
            icon={faLock}
            label={t('changePassword')}
            to={`${basePath}/password`}
          />
        </section>

        <div>
          <h2 className="settings-list-group-title">{t('appearance')}</h2>
          <section className="settings-list-card" aria-label={t('appearance')}>
            <SettingsRow icon={faSun} label={t('theme')} to={`${basePath}/appearance`} />
            <SettingsRow
              icon={faGear}
              label={t('language')}
              hint={lang === 'my' ? t('burmese') : t('english')}
              to={`${basePath}/language`}
            />
          </section>
        </div>

        <div>
          <h2 className="settings-list-group-title">{t('securityPrivacy')}</h2>
          <section className="settings-list-card" aria-label={t('securityPrivacy')}>
            <SettingsRow
              icon={faShieldHalved}
              label={t('notifications')}
              hint={t('notificationsHint')}
              to={`${basePath}/profile`}
            />
          </section>
        </div>

        {isAdmin && (
          <div>
            <h2 className="settings-list-group-title">{t('appBranding')}</h2>
            <section className="settings-list-card" aria-label={t('appBranding')}>
              <SettingsRow icon={faBuilding} label={t('appBranding')} to={`${basePath}/branding`} />
            </section>
          </div>
        )}

        <div>
          <h2 className="settings-list-group-title">{t('help')}</h2>
          <section className="settings-list-card" aria-label={t('help')}>
            <SettingsRow icon={faCircleQuestion} label={t('helpFeedback')} to={helpPath} />
            <SettingsRow icon={faCircleInfo} label={t('aboutApp')} to={`${basePath}/about`} />
          </section>
        </div>

        <button type="button" className="settings-signout-btn" onClick={onLogout}>
          <FontAwesomeIcon icon={faRightFromBracket} aria-hidden="true" />
          {t('signOut')}
        </button>
      </div>
    )
  }

  if (section === 'appearance') {
    return (
      <DetailShell title={t('theme')}>
        <section className="settings-list-card settings-detail-card space-y-4">
          <p className="page-subtitle m-0">{t('themeCopy')}</p>
          <ThemeSwitcher variant="cards" />
        </section>
      </DetailShell>
    )
  }

  if (section === 'language') {
    return (
      <DetailShell title={t('language')}>
        <section className="settings-list-card settings-detail-card">
          <label className="sr-only" htmlFor="settings-language-select">{t('language')}</label>
          <select
            id="settings-language-select"
            className="settings-select w-full"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
          >
            <option value="en">{t('english')}</option>
            <option value="my">{t('burmese')}</option>
          </select>
        </section>
      </DetailShell>
    )
  }

  if (section === 'about') {
    return (
      <DetailShell title={t('aboutApp')}>
        <section className="settings-list-card settings-detail-card space-y-3">
          <div className="settings-about-brand">
            <img src={appLogoUrl || '/brand/29-logo.png'} alt="" className="settings-about-logo" />
            <div>
              <div className="section-heading">{appName}</div>
              <div className="type-small text-[var(--color-muted)]">{appTagline}</div>
            </div>
          </div>
          <p className="type-small text-[var(--color-muted)] m-0">{t('aboutAppCopy')}</p>
        </section>
      </DetailShell>
    )
  }

  if (section === 'password') {
    return (
      <DetailShell title={t('changePassword')}>
        <section className="settings-list-card settings-detail-card space-y-3">
          <p className="page-subtitle m-0">{t('changePasswordCopy')}</p>
          <form onSubmit={onChangePassword} className="space-y-3">
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
      </DetailShell>
    )
  }

  if (section === 'branding' && isAdmin) {
    return (
      <DetailShell title={t('appBranding')}>
        <section className="settings-list-card settings-detail-card space-y-4">
          <p className="page-subtitle m-0">{t('appBrandingCopy')}</p>
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
                  <button type="button" className="btn btn-ghost" disabled={busy === 'logo'} onClick={onRemoveLogo}>
                    <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                    {t('removeLogo')}
                  </button>
                )}
              </div>
            </div>
          </div>
          <form onSubmit={onSaveApp} className="space-y-3">
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
      </DetailShell>
    )
  }

  return (
    <DetailShell title={t('publicProfile')}>
      <form onSubmit={onSaveProfile} className="public-profile">
        <div className="public-profile-main space-y-4">
          <div className="field">
            <label htmlFor="settings-name">{t('name')}</label>
            <input
              id="settings-name"
              autoComplete="name"
              required
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
            <small className="field-hint">{t('publicNameHint')}</small>
          </div>

          <div className="field">
            <label htmlFor="settings-email">{t('publicEmail')}</label>
            <div className="public-profile-email-row">
              <input id="settings-email" value={user?.email || ''} disabled />
            </div>
            <small className="field-hint">{t('publicEmailHint')}</small>
          </div>

          <div className="field">
            <label htmlFor="settings-phone">{t('phone')}</label>
            <input
              id="settings-phone"
              autoComplete="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
            <small className="field-hint">{t('publicPhoneHint')}</small>
          </div>

          <div className="field">
            <label htmlFor="settings-address">{t('bio')}</label>
            <textarea
              id="settings-address"
              rows={4}
              value={profile.address}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              placeholder={t('bioPlaceholder')}
            />
            <small className="field-hint">{t('publicBioHint')}</small>
          </div>

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
            {busy === 'profile' ? t('saving') : t('updateProfile')}
          </button>
        </div>

        <aside className="public-profile-photo">
          <div className="public-profile-photo-label">{t('profilePicture')}</div>
          <div className="public-profile-avatar-wrap" ref={avatarMenuRef}>
            <div className="public-profile-avatar" aria-hidden="true">
              {user?.avatar_url ? <img src={user.avatar_url} alt="" /> : <span>{initials}</span>}
            </div>
            <button
              type="button"
              className="public-profile-edit-btn"
              aria-haspopup="menu"
              aria-expanded={avatarMenuOpen}
              disabled={busy === 'avatar'}
              onClick={() => setAvatarMenuOpen((open) => !open)}
            >
              <FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" />
              {t('edit')}
            </button>
            {avatarMenuOpen && (
              <div className="public-profile-avatar-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAvatarMenuOpen(false)
                    fileRef.current?.click()
                  }}
                >
                  {t('uploadPhoto')}
                </button>
                {user?.avatar_url && (
                  <button
                    type="button"
                    role="menuitem"
                    className="is-danger"
                    onClick={() => {
                      setAvatarMenuOpen(false)
                      onRemoveAvatar()
                    }}
                  >
                    {t('removePhoto')}
                  </button>
                )}
              </div>
            )}
            <input
              ref={fileRef}
              id="settings-avatar-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={onAvatarSelected}
            />
          </div>
          <p className="field-hint m-0">{t('profilePhotoCopy')}</p>
        </aside>
      </form>
    </DetailShell>
  )
}
