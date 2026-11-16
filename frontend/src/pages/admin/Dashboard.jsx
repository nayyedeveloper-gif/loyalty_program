import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import api, { formatMMK, getErrorMessage } from '../../lib/api'
import {
  faBell,
  faBoxOpen,
  faChartLine,
  faCrown,
  faEnvelopeOpenText,
  faGem,
  faReceipt,
  faShoppingBag,
  faUsers,
} from '../../lib/icons'

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

  const alerts = data.alerts || {}
  const lowStock = alerts.low_stock_rewards || []
  const alertItems = [
    alerts.new_feedback > 0 && {
      key: 'feedback',
      to: '/admin/help',
      icon: faEnvelopeOpenText,
      label: t('alertNewFeedback', { count: alerts.new_feedback }),
    },
    alerts.pending_redemptions > 0 && {
      key: 'redemptions',
      to: '/admin/redemptions?status=pending',
      icon: faReceipt,
      label: t('alertPendingRedemptions', { count: alerts.pending_redemptions }),
    },
    lowStock.length > 0 && {
      key: 'stock',
      to: '/admin/rewards',
      icon: faShoppingBag,
      label: t('alertLowStock', { count: lowStock.length }),
    },
  ].filter(Boolean)

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
      to: '/admin/ledger',
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

      {alertItems.length > 0 && (
        <section className="stat-card" aria-label={t('dashboardAlerts')}>
          <h2 className="section-heading mb-3 flex items-center gap-2">
            <FontAwesomeIcon icon={faBell} className="text-[var(--color-primary)]" />
            {t('dashboardAlerts')}
          </h2>
          <div className="space-y-2">
            {alertItems.map((item) => (
              <Link
                key={item.key}
                to={item.to}
                className="list-row-link flex items-center gap-3 no-underline rounded-lg px-2 py-2"
              >
                <FontAwesomeIcon icon={item.icon} className="text-[var(--color-primary)]" aria-hidden="true" />
                <span className="type-small font-medium">{item.label}</span>
              </Link>
            ))}
            {lowStock.length > 0 && (
              <ul className="m-0 pl-5 type-meta text-[var(--color-muted)]">
                {lowStock.map((reward) => (
                  <li key={reward.id}>
                    {reward.name} — {t('stockLeft', { stock: reward.stock })}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

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

      <section className="dashboard-split">
        <div className="stat-card dashboard-panel dashboard-panel-tiers">
          <div className="dashboard-panel-head">
            <h2 className="section-heading dashboard-panel-title">
              <FontAwesomeIcon icon={faCrown} className="text-[var(--color-primary)]" aria-hidden="true" />
              <span>{t('tierDistribution')}</span>
            </h2>
            <Link to="/admin/customers" className="dashboard-panel-link">
              {t('customers')}
            </Link>
          </div>
          <div className="dashboard-panel-scroll space-y-1.5">
            {Object.entries(data.tier_distribution).map(([tier, count]) => (
              <Link
                key={tier}
                to={`/admin/customers?tier=${encodeURIComponent(tier)}`}
                className="list-row-link tier-dist-row"
              >
                <span className={`tier-pill tier-${tier}`}>{t(tier)}</span>
                <span className="tier-dist-count">
                  <strong>{count}</strong>
                  <span className="tier-dist-count-label">{t('members')}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="stat-card dashboard-panel dashboard-panel-purchases">
          <div className="dashboard-panel-head">
            <h2 className="section-heading dashboard-panel-title">
              <FontAwesomeIcon icon={faReceipt} className="text-[var(--color-primary)]" aria-hidden="true" />
              <span>{t('recentPurchases')}</span>
            </h2>
            <Link to="/admin/purchases" className="dashboard-panel-link">
              {t('purchases')}
            </Link>
          </div>
          <div className="dashboard-panel-scroll dashboard-panel-scroll-purchases space-y-3">
            {data.recent_purchases.map((p) => (
              <div key={p.id} className="purchase-row">
                <div className="purchase-row-copy min-w-0">
                  <div className="font-medium truncate">{p.product_name}</div>
                  <div className="type-meta text-[var(--color-muted)]">
                    {p.user?.customer_code ? `${p.user.customer_code} · ` : ''}
                    {p.user?.name} · {p.payment_method}
                  </div>
                </div>
                <div className="purchase-row-amount">
                  {formatMMK(p.net_amount)}
                </div>
              </div>
            ))}
            {!data.recent_purchases.length && (
              <p className="type-small text-[var(--color-muted)]">{t('noPurchasesYet')}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
