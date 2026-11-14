import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export default function ProtectedRoute({ role }) {
  const { user, loading } = useAuth()
  const { t } = useLanguage()

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-[var(--color-muted)]" role="status" aria-live="polite">
        {t('loadingMembershipGeneric')}
      </div>
    )
  }

  if (!user) return <Navigate to="/signin" replace />

  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/app'} replace />
  }

  return <Outlet />
}
