import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLanguage } from '../../context/LanguageContext'
import api, { formatMMK, getErrorMessage } from '../../lib/api'
import { faCrown, faGem } from '../../lib/icons'

export default function CustomerMembership() {
  const { t } = useLanguage()
  const [membership, setMembership] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/customer/membership')
      .then((res) => setMembership(res.data.membership))
      .catch((err) => setError(getErrorMessage(err, t('somethingWrong'))))
  }, [t])

  if (error) return <div className="alert alert-error" role="alert">{error}</div>
  if (!membership) {
    return (
      <div className="loading-state" role="status" aria-live="polite">
        {t('loadingMembership')}
      </div>
    )
  }

  const next = membership.next_tier

  return (
    <div className="space-y-6 w-full">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <FontAwesomeIcon icon={faCrown} className="text-[var(--color-primary)]" aria-hidden="true" />
            {t('myMembership')}
          </h1>
          <p className="page-subtitle">{t('membershipSubtitle')}</p>
        </div>
      </header>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <section className="stat-card">
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">{t('customerId')}</div>
          <div className="mt-2 text-2xl font-semibold tracking-wide">{membership.customer_code || '—'}</div>
        </section>

        <section className="stat-card overflow-hidden relative">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.28),transparent_55%)]" />
          <div className="relative">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">{t('currentTier')}</div>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <span className={`tier-pill tier-${membership.tier} text-base px-3 py-1`}>{t(membership.tier)}</span>
              <span className="text-sm text-[var(--color-muted)]">
                {t('memberDiscount', { percent: membership.discount_percent })}
              </span>
            </div>
          </div>
        </section>

        <section className="stat-card">
          <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider flex items-center gap-2">
            <FontAwesomeIcon icon={faGem} /> {t('points')}
          </div>
          <div className="mt-2 text-2xl font-semibold">{membership.points.toLocaleString()}</div>
        </section>

        <section className="stat-card">
          <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider">{t('totalSpent')}</div>
          <div className="mt-2 text-2xl font-semibold">{formatMMK(membership.total_spent)}</div>
        </section>
      </div>

      {next ? (
        <section className="stat-card">
          <h2 className="text-lg font-semibold m-0">
            {t('progressTo', { tier: t(next.name) })}
          </h2>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            {t('spendMore', {
              amount: formatMMK(next.remaining),
              tier: t(next.name),
              discount: membership.tiers[next.name].discount,
            })}
          </p>
          <div
            className="progress-track mt-4"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={next.progress}
            aria-label={t('progressTo', { tier: t(next.name) })}
          >
            <div className="progress-fill" style={{ width: `${next.progress}%` }} />
          </div>
          <div className="mt-2 text-xs text-[var(--color-muted)]">
            {t('progressPercent', { percent: next.progress })}
          </div>
        </section>
      ) : (
        <section className="stat-card">
          <h2 className="text-lg font-semibold m-0 flex items-center gap-2">
            <FontAwesomeIcon icon={faGem} className="text-[var(--color-primary)]" />
            {t('diamondStatus')}
          </h2>
          <p className="text-sm text-[var(--color-muted)] mt-1">{t('highestTier')}</p>
        </section>
      )}

      <section className="stat-card">
        <h2 className="text-lg font-semibold mb-3">{t('tierBenefits')}</h2>
        <div className="space-y-2">
          {Object.entries(membership.tiers).map(([name, cfg]) => (
            <div key={name} className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] py-2">
              <span className={`tier-pill tier-${name}`}>{t(name)}</span>
              <span className="text-sm text-[var(--color-muted)] text-right">
                {t('fromSpend', { amount: formatMMK(cfg.min), discount: cfg.discount })}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
