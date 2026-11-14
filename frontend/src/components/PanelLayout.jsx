import { useEffect, useId, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeSwitcher from './ThemeSwitcher'
import BrandLogo from './BrandLogo'
import { faChevronRight, faRightFromBracket } from '../lib/icons'

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
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const sidebarId = useId()
  const toggleRef = useRef(null)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
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
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setMobileOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isMobile, mobileOpen])

  async function onLogout() {
    await logout()
    navigate('/signin')
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

  return (
    <div className={`panel-shell ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
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
        {...(sidebarHidden ? { inert: '' } : {})}
      >
        <div className="sidebar-top">
          <div className={`sidebar-brand ${collapsed ? 'is-collapsed' : ''}`}>
            <BrandLogo
              size="sm"
              to="/"
              variant="light"
              showText={!collapsed}
              className="sidebar-brand-logo"
            />
            {!collapsed && <div className="sidebar-brand-sub">{t(titleKey)}</div>}
          </div>
        </div>

        <nav className="sidebar-nav" aria-label={t('mainNavigation')}>
          {links.map((link) => {
            if (link.children?.length) {
              const parentActive = linkIsActive(location.pathname, link)
              const expanded = Boolean(openMenus[link.to]) || (collapsed && parentActive)
              const defaultChild = link.children[0]?.to || link.to

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
                      {link.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          title={t(child.labelKey)}
                          onClick={closeMobile}
                          className={({ isActive }) => `sidebar-link sidebar-sublink ${isActive ? 'active' : ''}`}
                        >
                          <FontAwesomeIcon icon={child.icon} className="sidebar-link-icon" aria-hidden="true" />
                          <span className="sidebar-link-label">{t(child.labelKey)}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

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
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-avatar" aria-hidden="true">
              {user?.avatar_url ? <img src={user.avatar_url} alt="" /> : initials}
            </div>
            {!collapsed && (
              <div className="sidebar-user">
                <div className="sidebar-user-name">{user?.name}</div>
                <div className="sidebar-user-email">{user?.email}</div>
              </div>
            )}
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
            <ThemeSwitcher variant="icon" />
            <LanguageSwitcher />
            <span className="role-badge">
              {user?.role === 'admin' ? t('adminPortal') : t('memberApp')}
            </span>
          </div>
        </header>
        <main id="main-content" className="panel-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
