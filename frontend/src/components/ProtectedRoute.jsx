import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

function homeForRole(role) {
  if (role === 'admin' || role === 'staff') return '/admin'
  return '/app'
}

export default function ProtectedRoute({ role, roles }) {
  const { user, loading } = useAuth()
  const { t } = useLanguage()
  const allowed = roles || (role ? [role] : null)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-[var(--color-muted)]" role="status" aria-live="polite">
        {t('loadingMembershipGeneric')}
      </div>
    )
  }

  if (!user) return <Navigate to="/signin" replace />

  if (allowed && !allowed.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />
  }

  return <Outlet />
}
