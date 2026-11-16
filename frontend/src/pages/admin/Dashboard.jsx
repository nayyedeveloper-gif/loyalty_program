import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import api, { formatMMK, getErrorMessage } from '../../lib/api'
import { faBoxOpen, faChartLine, faCrown, faGem, faReceipt, faUsers } from '../../lib/icons'

export default function AdminDashboard() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/admin/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err, t('somethingWrong'))))
  }, [t])

  if (error) return <div className="alert alert-error" role="alert">{error}</div>
  if (!data) {
    return (
      <div className="loading-state" role="status" aria-live="polite">
        {t('loadingDashboard')}
      </div>
    )
  }

  const stats = [
    {
      label: t('members'),
      value: data.stats.customers,
      icon: faUsers,
      to: '/admin/customers',
    },
    {
      label: t('purchases'),
      value: data.stats.purchases,
      icon: faBoxOpen,
      to: '/admin/purchases',
    },
    {
      label: t('netRevenue'),
      value: formatMMK(data.stats.revenue),
      icon: faChartLine,
      to: '/admin/purchases',
    },
    {
      label: t('pointsIssued'),
      value: data.stats.points_issued.toLocaleString(),
      icon: faGem,
      to: '/admin/purchases',
    },
  ]

  return (
    <div className="space-y-6">
      <section className="welcome-banner">
        <span className="welcome-banner-eyebrow">{t('adminPortal')}</span>
        <h1>
          {t('welcome')}, {user?.name || 'Admin'}!
        </h1>
        <p>{t('dashboardSubtitle')}</p>
      </section>

      <div className="stat-grid">
        {stats.map((stat, i) => (
          <Link
            key={stat.label}
            to={stat.to}
            className="stat-card stat-card-link"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="meta-label">{stat.label}</div>
              <FontAwesomeIcon icon={stat.icon} className="text-[var(--color-primary)]" />
            </div>
            <div className="stat-value mt-2">{stat.value}</div>
          </Link>
        ))}
      </div>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="stat-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="section-heading flex items-center gap-2">
              <FontAwesomeIcon icon={faCrown} className="text-[var(--color-primary)]" />
              {t('tierDistribution')}
            </h2>
            <Link to="/admin/customers" className="type-small text-[var(--color-primary)] font-medium">
              {t('customers')}
            </Link>
          </div>
          <div className="space-y-3">
            {Object.entries(data.tier_distribution).map(([tier, count]) => (
              <Link
                key={tier}
                to={`/admin/customers?tier=${encodeURIComponent(tier)}`}
                className="flex items-center justify-between no-underline text-inherit rounded-lg px-1 py-1 hover:bg-[#f8fafc]"
              >
                <span className={`tier-pill tier-${tier}`}>{t(tier)}</span>
                <span className="font-medium">{count} {t('members')}</span>
              </Link>
            ))}
          </div>
        </div>

        <Link to="/admin/purchases" className="stat-card stat-card-link block no-underline text-inherit">
          <h2 className="section-heading mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faReceipt} className="text-[var(--color-primary)]" />
            {t('recentPurchases')}
          </h2>
          <div className="space-y-3">
            {data.recent_purchases.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] pb-3">
                <div>
                  <div className="font-medium">{p.product_name}</div>
                  <div className="type-meta text-[var(--color-muted)]">
                    {p.user?.customer_code ? `${p.user.customer_code} · ` : ''}
                    {p.user?.name} · {p.payment_method}
                  </div>
                </div>
                <div className="type-small text-right font-semibold">{formatMMK(p.net_amount)}</div>
              </div>
            ))}
            {!data.recent_purchases.length && (
              <p className="type-small text-[var(--color-muted)]">{t('noPurchasesYet')}</p>
            )}
          </div>
        </Link>
      </section>
    </div>
  )
}
