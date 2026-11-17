import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAppSettings } from '../context/AppSettingsContext'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import ConfirmModal from '../components/ConfirmModal'
import ThemeSwitcher from '../components/ThemeSwitcher'
import api, { getErrorMessage, mediaUrl } from '../lib/api'
import {
  faBuilding,
  faCamera,
  faChevronLeft,
  faChevronRight,
  faCircleInfo,
  faCircleQuestion,
  faEnvelope,
  faFloppyDisk,
  faHeadset,
  faKey,
  faLock,
  faPenToSquare,
  faRightFromBracket,
  faTrash,
  faUser,
} from '../lib/icons'

const DETAIL_SECTIONS = ['profile', 'password', 'about', 'faq', 'branding']

function DetailShell({ title, children, error, message, onBack, backLabel }) {
  return (
    <div className="space-y-5 w-full settings-hub">
      <header className="settings-hub-header">
        <button type="button" className="settings-hub-back" onClick={onBack} aria-label={backLabel}>
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

function SettingsRow({
  icon,
  label,
  hint,
  onClick,
  to,
  href,
  danger = false,
  showChevron = true,
  trailing = null,
}) {
  const className = `settings-list-row ${danger ? 'is-danger' : ''} ${trailing ? 'has-trailing' : ''}`
  const content = (
    <>
      {icon ? (
        <span className="settings-list-icon" aria-hidden="true">
          <FontAwesomeIcon icon={icon} />
        </span>
      ) : null}
      <span className="settings-list-copy">
        <span className="settings-list-label">{label}</span>
        {hint ? <span className="settings-list-hint">{hint}</span> : null}
      </span>
      {trailing}
      {!trailing && showChevron ? (
        <FontAwesomeIcon icon={faChevronRight} className="settings-list-chevron" aria-hidden="true" />
      ) : null}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    )
  }

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
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
  const { user, setUser, isAdmin, isStaff, logout } = useAuth()
  const { t, lang, setLang } = useLanguage()
  const { appName, appTagline, appLogoUrl, updateSettings, uploadLogo, removeLogo } = useAppSettings()
  const fileRef = useRef(null)
  const logoRef = useRef(null)
  const avatarMenuRef = useRef(null)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const isPortal = isAdmin || isStaff
  const basePath = isPortal ? '/admin/settings' : '/app/settings'
  const helpPath = isAdmin ? '/admin/help' : '/app/help'

  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    date_of_birth: user?.date_of_birth ? String(user.date_of_birth).slice(0, 10) : '',
  })
  const [prefs, setPrefs] = useState({
    email_notifications: user?.preferences?.email_notifications ?? true,
    purchase_alerts: user?.preferences?.purchase_alerts ?? true,
    in_app_notifications: user?.preferences?.in_app_notifications ?? true,
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
  const [faqs, setFaqs] = useState([])
  const [faqsLoading, setFaqsLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)

  // Sync from server user only when saved values change — not on every render.
  useEffect(() => {
    setProfile({
      name: user?.name || '',
      phone: user?.phone || '',
      address: user?.address || '',
      date_of_birth: user?.date_of_birth ? String(user.date_of_birth).slice(0, 10) : '',
    })
    setPrefs({
      email_notifications: user?.preferences?.email_notifications ?? true,
      purchase_alerts: user?.preferences?.purchase_alerts ?? true,
      in_app_notifications: user?.preferences?.in_app_notifications ?? true,
    })
  }, [
    user?.id,
    user?.name,
    user?.phone,
    user?.address,
    user?.date_of_birth,
    user?.preferences?.email_notifications,
    user?.preferences?.purchase_alerts,
    user?.preferences?.in_app_notifications,
  ])

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

  useEffect(() => {
    if (section !== 'faq') return undefined
    let cancelled = false
    setFaqsLoading(true)
    api
      .get('/faqs')
      .then(({ data }) => {
        if (!cancelled) {
          setFaqs(data.faqs || [])
          setError('')
        }
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, t('somethingWrong')))
      })
      .finally(() => {
        if (!cancelled) setFaqsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [section, t])

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

  async function confirmDeleteAccount() {
    setBusy('delete')
    setError('')
    setMessage('')
    try {
      await api.delete('/settings/account')
      setDeleteAccountOpen(false)
      await logout()
      navigate('/signin')
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotDeleteAccount')))
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

  const avatarMenu = (
    <div className="settings-profile-avatar-wrap" ref={avatarMenuRef}>
      <div className="settings-profile-avatar" aria-hidden="true">
        {user?.avatar_url ? <img src={mediaUrl(user.avatar_url)} alt="" /> : <span>{initials}</span>}
      </div>
      <button
        type="button"
        className="settings-profile-edit-btn"
        aria-label={t('edit')}
        aria-haspopup="menu"
        aria-expanded={avatarMenuOpen}
        disabled={busy === 'avatar'}
        onClick={() => setAvatarMenuOpen((open) => !open)}
      >
        <FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" />
      </button>
      {avatarMenuOpen && (
        <div className="settings-profile-avatar-menu" role="menu">
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
          {user?.avatar_url ? (
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
          ) : null}
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
  )

  if (section === 'general') {
    return (
      <div className="space-y-5 w-full settings-hub">
        <header className="settings-hub-header">
          <button
            type="button"
            className="settings-hub-back"
            onClick={() => navigate(-1)}
            aria-label={t('back')}
          >
            <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
          </button>
          <h1 className="settings-hub-title">{t('settings')}</h1>
          <span className="settings-hub-spacer" aria-hidden="true" />
        </header>

        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {message && <div className="alert alert-ok" role="status" aria-live="polite">{message}</div>}

        <section className="settings-profile-card" aria-label={t('profile')}>
          {avatarMenu}
          <div className="settings-profile-meta">
            <div className="settings-profile-name">{user?.name || '—'}</div>
            <div className="settings-profile-email">{user?.email || '—'}</div>
          </div>
        </section>

        <section className="settings-list-card" aria-label={t('editProfileDetails')}>
          <SettingsRow
            icon={faUser}
            label={t('editProfileDetails')}
            hint={user?.phone || t('notSet')}
            to={`${basePath}/profile`}
          />
        </section>

        <div>
          <h2 className="settings-list-group-title">{t('appearance')}</h2>
          <section className="settings-list-card" aria-label={t('appearance')}>
            <div className="settings-list-row has-trailing">
              <span className="settings-list-copy">
                <span className="settings-list-label">{t('theme')}</span>
                <span className="settings-list-hint">{t('themeCopy')}</span>
              </span>
              <ThemeSwitcher variant="switch" />
            </div>
            <div className="settings-list-row has-trailing">
              <span className="settings-list-copy">
                <span className="settings-list-label">{t('language')}</span>
                <span className="settings-list-hint">{lang === 'my' ? t('burmese') : t('english')}</span>
              </span>
              <div className="settings-inline-switch" role="group" aria-label={t('language')}>
                <button
                  type="button"
                  className={lang === 'en' ? 'active' : ''}
                  onClick={() => setLang('en')}
                  aria-pressed={lang === 'en'}
                >
                  EN
                </button>
                <button
                  type="button"
                  className={lang === 'my' ? 'active' : ''}
                  onClick={() => setLang('my')}
                  aria-pressed={lang === 'my'}
                >
                  MY
                </button>
              </div>
            </div>
          </section>
        </div>

        <div>
          <h2 className="settings-list-group-title">{t('accountManagement')}</h2>
          <section className="settings-list-card" aria-label={t('accountManagement')}>
            <SettingsRow icon={faLock} label={t('changePassword')} to={`${basePath}/password`} />
            <SettingsRow icon={faKey} label={t('forgotPassword')} to="/forgot-password" />
            {!isPortal && (
              <SettingsRow
                icon={faTrash}
                label={t('deleteAccount')}
                hint={t('deleteAccountHint')}
                danger
                onClick={() => setDeleteAccountOpen(true)}
              />
            )}
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
            <SettingsRow icon={faCircleQuestion} label={t('faq')} to={`${basePath}/faq`} />
            <SettingsRow icon={faCircleInfo} label={t('aboutApp')} to={`${basePath}/about`} />
            {isAdmin && (
              <SettingsRow icon={faHeadset} label={t('customerFeedback')} to={helpPath} />
            )}
            {!isPortal && (
              <SettingsRow icon={faHeadset} label={t('customerService')} to={helpPath} />
            )}
          </section>
        </div>

        <button type="button" className="settings-signout-btn" onClick={onLogout}>
          <FontAwesomeIcon icon={faRightFromBracket} aria-hidden="true" />
          {t('signOut')}
        </button>

        <ConfirmModal
          open={deleteAccountOpen}
          title={t('confirmDeleteTitle')}
          message={t('deleteAccountConfirm')}
          confirmLabel={t('deleteAccount')}
          busy={busy === 'delete'}
          onCancel={() => setDeleteAccountOpen(false)}
          onConfirm={confirmDeleteAccount}
        />
      </div>
    )
  }

  const detailShellProps = {
    error,
    message,
    onBack: () => navigate(-1),
    backLabel: t('back'),
  }

  if (section === 'about') {
    return (
      <DetailShell title={t('aboutApp')} {...detailShellProps}>
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

  if (section === 'faq') {
    return (
      <DetailShell title={t('faq')} {...detailShellProps}>
        <section className="settings-list-card settings-detail-card space-y-4">
          {isAdmin && (
            <SettingsRow
              icon={faCircleQuestion}
              label={t('manageFaqs')}
              hint={t('manageFaqsCopy')}
              to="/admin/faqs"
            />
          )}
          {faqsLoading && (
            <p className="type-meta text-[var(--color-muted)] m-0" role="status">
              {t('loading')}
            </p>
          )}
          {!faqsLoading &&
            faqs.map((item) => {
              const question = lang === 'my' ? item.question_my || item.question_en : item.question_en
              const answer = lang === 'my' ? item.answer_my || item.answer_en : item.answer_en
              return (
                <article key={item.id} className="settings-faq-item">
                  <h3 className="settings-faq-q">{question}</h3>
                  <p className="settings-faq-a">{answer}</p>
                </article>
              )
            })}
          {!faqsLoading && !faqs.length && (
            <p className="type-meta text-[var(--color-muted)] m-0">{t('noFaqsFound')}</p>
          )}
          {isAdmin && (
            <SettingsRow
              icon={faEnvelope}
              label={t('customerFeedback')}
              hint={t('customerFeedbackCopy')}
              to={helpPath}
            />
          )}
          {!isPortal && (
            <SettingsRow
              icon={faEnvelope}
              label={t('customerService')}
              hint={t('helpFeedbackHint')}
              to={helpPath}
            />
          )}
        </section>
      </DetailShell>
    )
  }

  if (section === 'password') {
    return (
      <DetailShell title={t('changePassword')} {...detailShellProps}>
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
      <DetailShell title={t('appBranding')} {...detailShellProps}>
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
                onChange={(e) => setAppForm((prev) => ({ ...prev, app_name: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="settings-app-tagline">{t('appTagline')}</label>
              <input
                id="settings-app-tagline"
                maxLength={120}
                value={appForm.app_tagline}
                onChange={(e) => setAppForm((prev) => ({ ...prev, app_tagline: e.target.value }))}
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
    <DetailShell title={t('editProfileDetails')} {...detailShellProps}>
      <form onSubmit={onSaveProfile} className="settings-list-card settings-detail-card space-y-4">
        <div className="field">
          <label htmlFor="settings-name">{t('name')}</label>
          <input
            id="settings-name"
            autoComplete="name"
            required
            value={profile.name}
            onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
          />
          <small className="field-hint">{t('publicNameHint')}</small>
        </div>

        <div className="field">
          <label htmlFor="settings-email">{t('publicEmail')}</label>
          <input id="settings-email" value={user?.email || ''} disabled />
          <small className="field-hint">{t('publicEmailHint')}</small>
        </div>

        <div className="field">
          <label htmlFor="settings-phone">{t('phone')}</label>
          <input
            id="settings-phone"
            autoComplete="tel"
            value={profile.phone}
            onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
          />
          <small className="field-hint">{t('publicPhoneHint')}</small>
        </div>

        <div className="field">
          <label htmlFor="settings-address">{t('bio')}</label>
          <textarea
            id="settings-address"
            rows={4}
            value={profile.address}
            onChange={(e) => setProfile((prev) => ({ ...prev, address: e.target.value }))}
            placeholder={t('bioPlaceholder')}
          />
          <small className="field-hint">{t('publicBioHint')}</small>
        </div>

        <div className="field">
          <label htmlFor="settings-dob">{t('dateOfBirth')}</label>
          <input
            id="settings-dob"
            type="date"
            value={profile.date_of_birth}
            onChange={(e) => setProfile((prev) => ({ ...prev, date_of_birth: e.target.value }))}
          />
          <small className="field-hint">{t('dateOfBirthHint')}</small>
        </div>

        <div className="settings-toggles">
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={!!prefs.email_notifications}
              onChange={(e) => setPrefs((prev) => ({ ...prev, email_notifications: e.target.checked }))}
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
              onChange={(e) => setPrefs((prev) => ({ ...prev, purchase_alerts: e.target.checked }))}
            />
            <span>
              <strong>{t('purchaseAlerts')}</strong>
              <small>{t('purchaseAlertsCopy')}</small>
            </span>
          </label>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={!!prefs.in_app_notifications}
              onChange={(e) => setPrefs((prev) => ({ ...prev, in_app_notifications: e.target.checked }))}
            />
            <span>
              <strong>{t('inAppNotifications')}</strong>
              <small>{t('inAppNotificationsCopy')}</small>
            </span>
          </label>
        </div>

        <button type="submit" className="btn btn-primary" disabled={busy === 'profile'}>
          <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
          {busy === 'profile' ? t('saving') : t('updateProfile')}
        </button>
      </form>
    </DetailShell>
  )
}
