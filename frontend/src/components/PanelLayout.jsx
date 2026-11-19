import { useEffect, useId, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { useLanguage } from '../context/LanguageContext'
import api, { mediaUrl } from '../lib/api'
import { useNotifications } from '../context/NotificationContext'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeSwitcher from './ThemeSwitcher'
import BrandLogo from './BrandLogo'
import SpinGrantNotice from '../modules/spinwheel/components/SpinGrantNotice'
import {
  faBell,
  faChevronRight,
  faCircleQuestion,
  faEllipsis,
  faEnvelopeOpenText,
  faGear,
  faRightFromBracket,
} from '../lib/icons'

function SidebarPanelIcon() {
  return (
    <svg className="sidebar-panel-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="2.5" y="2.5" width="15" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="2.5" y="2.5" width="5" height="15" rx="0" fill="currentColor" opacity="0.9" />
    </svg>
  )
}

function useIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false,
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])

  return isMobile
}

function linkIsActive(pathname, link) {
  if (link.children?.length) {
    return pathname === link.to || pathname.startsWith(`${link.to}/`)
  }
  if (link.end) return pathname === link.to
  return pathname === link.to || pathname.startsWith(`${link.to}/`)
}

export default function PanelLayout({ titleKey, links }) {
  const { user, logout } = useAuth()
  const { unreadCount, markAllRead } = useNotifications()
  const { unreadCount: chatUnreadCount } = useChat()
  const { t } = useLanguage()
  const [spinPromoPending, setSpinPromoPending] = useState(false)
  const [stockAlertCount, setStockAlertCount] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  // Same source as the chat FAB — don't Math.max with locally bumped row counts.
  const inboxUnread = Number(chatUnreadCount || 0)
  const isMobile = useIsMobile()
  const sidebarId = useId()
  const toggleRef = useRef(null)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef(null)
  const [openMenus, setOpenMenus] = useState(() => {
    const initial = {}
    links.forEach((link) => {
      if (link.children?.length && linkIsActive(location.pathname, link)) {
        initial[link.to] = true
      }
    })
    return initial
  })

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    if (!isMobile) setMobileOpen(false)
  }, [isMobile])

  useEffect(() => {
    setMobileOpen(false)
    setAccountMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    setOpenMenus((prev) => {
      const next = { ...prev }
      links.forEach((link) => {
        if (link.children?.length && linkIsActive(location.pathname, link)) {
          next[link.to] = true
        }
      })
      return next
    })
  }, [location.pathname, links])

  useEffect(() => {
    if (!isMobile || !mobileOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setMobileOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isMobile, mobileOpen])

  useEffect(() => {
    if (user?.role !== 'customer') {
      setSpinPromoPending(false)
      return undefined
    }

    let cancelled = false
    const refresh = async () => {
      try {
        const { data } = await api.get('/spinwheel/promos/pending')
        if (!cancelled) setSpinPromoPending(!!data?.has_pending)
      } catch {
        if (!cancelled) setSpinPromoPending(false)
      }
    }

    refresh()
    const timer = setInterval(refresh, 60000)
    const onFocus = () => refresh()
    const onPromoChanged = (event) => {
      if (typeof event?.detail?.hasPending === 'boolean') {
        setSpinPromoPending(event.detail.hasPending)
      } else {
        refresh()
      }
    }

    window.addEventListener('focus', onFocus)
    window.addEventListener('spinwheel:promo-changed', onPromoChanged)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('spinwheel:promo-changed', onPromoChanged)
    }
  }, [user?.role, user?.id])

  useEffect(() => {
    if (user?.role !== 'admin') {
      setStockAlertCount(0)
      return undefined
    }

    let cancelled = false
    const refresh = async () => {
      try {
        const { data } = await api.get('/spinwheel/admin/stock-alerts')
        if (!cancelled) setStockAlertCount(Number(data?.count) || 0)
      } catch {
        if (!cancelled) setStockAlertCount(0)
      }
    }

    refresh()
    const timer = setInterval(refresh, 45000)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [user?.role, user?.id, location.pathname])

  useEffect(() => {
    if (!accountMenuOpen) return undefined
    function onPointerDown(e) {
      if (!accountMenuRef.current?.contains(e.target)) {
        setAccountMenuOpen(false)
      }
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setAccountMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [accountMenuOpen])

  async function onLogout() {
    setAccountMenuOpen(false)
    await logout()
    navigate('/signin')
  }

  const isPortal = user?.role === 'admin' || user?.role === 'staff'
  const settingsPath = isPortal ? '/admin/settings/general' : '/app/settings/general'
  const helpPath = user?.role === 'admin' ? '/admin/help' : isPortal ? '/admin/settings/faq' : '/app/help'
  const notificationsPath = isPortal ? '/admin/notifications' : '/app/notifications'

  async function openNotifications() {
    closeMobile()
    if (unreadCount > 0) {
      try {
        await markAllRead()
      } catch {
        // Badge will resync on next poll if mark-all failed.
      }
    }
    navigate(notificationsPath)
  }

  function toggleSidebar() {
    if (isMobile) {
      setMobileOpen((open) => !open)
      return
    }
    setCollapsed((value) => !value)
  }

  function closeMobile() {
    setMobileOpen(false)
  }

  function toggleMenu(to) {
    setOpenMenus((prev) => ({ ...prev, [to]: !prev[to] }))
  }

  const initials = (user?.name || 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const toggleLabel = isMobile
    ? (mobileOpen ? t('hideMenu') : t('menu'))
    : (collapsed ? t('expandSidebar') : t('collapseSidebar'))
  const sidebarHidden = isMobile && !mobileOpen
  const showLabels = !collapsed || isMobile
  const shellCollapsed = collapsed && !isMobile

  return (
    <div className={`panel-shell ${shellCollapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
      <a href="#main-content" className="skip-link">{t('skipToContent')}</a>

      {mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label={t('hideMenu')}
          onClick={() => {
            setMobileOpen(false)
            toggleRef.current?.focus()
          }}
        />
      )}

      <aside
        id={sidebarId}
        className="sidebar"
        aria-label={t('mainNavigation')}
        aria-hidden={sidebarHidden || undefined}
        {...(sidebarHidden ? { inert: true } : {})}
      >
        <div className="sidebar-top">
          <div className={`sidebar-brand ${shellCollapsed ? 'is-collapsed' : ''}`}>
            <BrandLogo
              size="sm"
              to="/"
              variant="light"
              showText={showLabels}
              className="sidebar-brand-logo"
            />
            {showLabels && <div className="sidebar-brand-sub">{t(titleKey)}</div>}
          </div>
        </div>

        <nav className="sidebar-nav" aria-label={t('mainNavigation')}>
          {links.map((link) => {
            if (link.children?.length) {
              const parentActive = linkIsActive(location.pathname, link)
              const expanded = Boolean(openMenus[link.to]) || (collapsed && parentActive)
              const defaultChild = link.children[0]?.to || link.to
              const showStockBadge = stockAlertCount > 0 && link.to === '/admin/spinwheel'

              return (
                <div key={link.to} className={`sidebar-group ${expanded ? 'is-open' : ''} ${parentActive ? 'is-active' : ''}`}>
                  <button
                    type="button"
                    className={`sidebar-link sidebar-group-toggle ${parentActive ? 'active' : ''}`}
                    title={t(link.labelKey)}
                    aria-expanded={expanded}
                    onClick={() => {
                      if (collapsed && !isMobile) {
                        setCollapsed(false)
                        setOpenMenus((prev) => ({ ...prev, [link.to]: true }))
                        navigate(defaultChild)
                        return
                      }
                      toggleMenu(link.to)
                    }}
                  >
                    <FontAwesomeIcon icon={link.icon} className="sidebar-link-icon" aria-hidden="true" />
                    <span className="sidebar-link-label">{t(link.labelKey)}</span>
                    {showStockBadge && (
                      <span className="sidebar-link-badge" aria-label={`${stockAlertCount} prizes out of stock`} />
                    )}
                    {showLabels && (
                      <FontAwesomeIcon
                        icon={faChevronRight}
                        className={`sidebar-group-chevron ${expanded ? 'is-open' : ''}`}
                        aria-hidden="true"
                      />
                    )}
                  </button>

                  {expanded && showLabels && (
                    <div className="sidebar-subnav" role="group" aria-label={t(link.labelKey)}>
                      {link.children.map((child) => {
                        const childStockBadge = stockAlertCount > 0 && child.to === '/admin/spinwheel/wheel'
                        return (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            title={t(child.labelKey)}
                            onClick={closeMobile}
                            className={({ isActive }) => `sidebar-link sidebar-sublink ${isActive ? 'active' : ''}`}
                          >
                            <FontAwesomeIcon icon={child.icon} className="sidebar-link-icon" aria-hidden="true" />
                            <span className="sidebar-link-label">{t(child.labelKey)}</span>
                            {childStockBadge && (
                              <span className="sidebar-link-badge" aria-label={`${stockAlertCount} prizes out of stock`} />
                            )}
                          </NavLink>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            const showPromoBadge = spinPromoPending && link.to === '/app/spinwheel'
            const badgeCount = link.badge === 'chat' ? inboxUnread : 0

            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                title={t(link.labelKey)}
                onClick={closeMobile}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <FontAwesomeIcon icon={link.icon} className="sidebar-link-icon" aria-hidden="true" />
                <span className="sidebar-link-label">{t(link.labelKey)}</span>
                {showPromoBadge && (
                  <span className="sidebar-link-badge" aria-label="Spin promotion available" />
                )}
                {badgeCount > 0 ? (
                  <span className="sidebar-link-badge" aria-label={t('chatUnread', { count: badgeCount })}>
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                ) : null}
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-account" ref={accountMenuRef}>
            {accountMenuOpen && (
              <div className="sidebar-account-menu" role="menu" aria-label={t('accountMenu')}>
                <button
                  type="button"
                  className="sidebar-account-item"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false)
                    closeMobile()
                    navigate(settingsPath)
                  }}
                >
                  <FontAwesomeIcon icon={faGear} aria-hidden="true" />
                  <span>{t('settings')}</span>
                </button>
                <button
                  type="button"
                  className="sidebar-account-item"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false)
                    closeMobile()
                    navigate(helpPath)
                  }}
                >
                  <FontAwesomeIcon
                    icon={user?.role === 'admin' ? faEnvelopeOpenText : faCircleQuestion}
                    aria-hidden="true"
                  />
                  <span>
                    {t(
                      user?.role === 'admin'
                        ? 'customerFeedback'
                        : user?.role === 'staff'
                          ? 'help'
                          : 'helpFeedback',
                    )}
                  </span>
                </button>
              </div>
            )}
            <button
              type="button"
              className={`sidebar-user-card ${accountMenuOpen ? 'is-open' : ''}`}
              onClick={() => setAccountMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              title={user?.name || t('accountMenu')}
            >
              <div className="sidebar-avatar" aria-hidden="true">
                {user?.avatar_url ? <img src={mediaUrl(user.avatar_url)} alt="" /> : initials}
              </div>
              {showLabels && (
                <>
                  <div className="sidebar-user">
                    <div className="sidebar-user-name">{user?.name}</div>
                    <div className="sidebar-user-email">{user?.email}</div>
                  </div>
                  <FontAwesomeIcon icon={faEllipsis} className="sidebar-user-more" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
          <button type="button" className="btn btn-sidebar-logout" onClick={onLogout} title={t('signOut')} aria-label={t('signOut')}>
            <FontAwesomeIcon icon={faRightFromBracket} aria-hidden="true" />
            <span className="sidebar-link-label">{t('signOut')}</span>
          </button>
        </div>
      </aside>

      <div className="panel-main">
        <header className="panel-topbar">
          <button
            ref={toggleRef}
            type="button"
            className="sidebar-panel-toggle"
            onClick={toggleSidebar}
            aria-label={toggleLabel}
            title={toggleLabel}
            aria-expanded={isMobile ? mobileOpen : !collapsed}
            aria-controls={sidebarId}
          >
            <SidebarPanelIcon />
          </button>
          <div className="panel-topbar-mobile-brand">
            <BrandLogo size="sm" to="/" className="panel-toolbar-logo" showText />
          </div>
          <div className="panel-topbar-actions">
            <button
              type="button"
              className="btn btn-ghost btn-icon-action notification-bell"
              onClick={openNotifications}
              aria-label={t('notifications')}
              title={t('notifications')}
            >
              <FontAwesomeIcon icon={faBell} aria-hidden="true" />
              {unreadCount > 0 ? (
                <span className="notification-badge" aria-hidden="true">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : null}
            </button>
            <ThemeSwitcher variant="icon" />
            <LanguageSwitcher compact={isMobile} />
            <span className="role-badge desktop-only">
              {user?.role === 'admin'
                ? t('adminPortal')
                : user?.role === 'staff'
                  ? t('staffPortal')
                  : t('memberApp')}
            </span>
          </div>
        </header>
        <main id="main-content" className="panel-content" tabIndex={-1}>
          {user?.role === 'customer' && <SpinGrantNotice />}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
