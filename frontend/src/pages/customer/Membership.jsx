import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import QRCode from 'qrcode'
import { useLanguage } from '../../context/LanguageContext'
import api, { formatMMK, getErrorMessage } from '../../lib/api'
import { faCircleInfo, faCrown, faGem, faTrophy } from '../../lib/icons'

function daysUntil(iso) {
  if (!iso) return null
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return null
  const ms = target.getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

export default function CustomerMembership() {
  const { t, lang } = useLanguage()
  const [membership, setMembership] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/customer/membership')
      .then((res) => setMembership(res.data.membership))
      .catch((err) => setError(getErrorMessage(err, t('somethingWrong'))))
  }, [t])

  useEffect(() => {
    if (!membership?.customer_code) {
      setQrDataUrl('')
      return undefined
    }
    let cancelled = false
    QRCode.toDataURL(`29G:${membership.customer_code}`, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [membership?.customer_code])

  const expiryDays = useMemo(
    () => daysUntil(membership?.points_expire_at),
    [membership?.points_expire_at],
  )

  if (error) return <div className="alert alert-error" role="alert">{error}</div>
  if (!membership) {
    return (
      <div className="loading-state" role="status" aria-live="polite">
        {t('loadingMembership')}
      </div>
    )
  }

  const next = membership.next_tier
  const settings = membership.settings || {}
  const currentPerks = membership.tiers?.[membership.tier]?.perks || []
  const expiryDateLabel = membership.points_expire_at
    ? new Date(membership.points_expire_at).toLocaleDateString(lang === 'my' ? 'my-MM' : 'en-GB')
    : '—'

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

      <section className="stat-card membership-card" aria-label={t('membershipCard')}>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt=""
            className="membership-qr"
            width={148}
            height={148}
          />
        ) : (
          <div className="membership-qr grid place-items-center type-meta text-[var(--color-muted)]">
            {membership.customer_code || '—'}
          </div>
        )}
        <div className="space-y-2">
          <h2 className="section-heading m-0">{t('membershipCard')}</h2>
          <div className="stat-value tracking-wide">{membership.customer_code || '—'}</div>
          <div className="font-medium">{membership.name}</div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`tier-pill tier-${membership.tier}`}>{t(membership.tier)}</span>
            <span className="type-small text-[var(--color-muted)]">
              {Number(membership.redeemable_points || 0).toLocaleString()} {t('points')}
            </span>
          </div>
          <p className="type-meta text-[var(--color-muted)] m-0">{t('membershipCardHint')}</p>
        </div>
      </section>

      {expiryDays !== null && expiryDays <= 45 && Number(membership.redeemable_points || 0) > 0 && (
        <div className={`alert ${expiryDays <= 7 ? 'alert-error' : 'alert-ok'}`} role="status">
          {t('pointsExpiryCountdown', {
            days: expiryDays,
            points: Number(membership.redeemable_points || 0).toLocaleString(),
            date: expiryDateLabel,
          })}
        </div>
      )}

      <div className="stat-grid auto-fit">
        <section className="stat-card">
          <div className="meta-label">{t('customerId')}</div>
          <div className="stat-value mt-2 tracking-wide">{membership.customer_code || '—'}</div>
          <div className="type-meta mt-2 text-[var(--color-muted)]">
            {t('referralCode')}: <strong>{membership.referral_code || '—'}</strong>
          </div>
        </section>

        <section className="stat-card overflow-hidden relative">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.28),transparent_55%)]" />
          <div className="relative">
            <div className="meta-label">{t('currentTier')}</div>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <span className={`tier-pill tier-${membership.tier} px-3 py-1`}>{t(membership.tier)}</span>
              <span className="type-small text-[var(--color-muted)]">
                {t('earnMultiplier', { multiplier: membership.earn_multiplier })}
              </span>
            </div>
            {currentPerks.length > 0 && (
              <ul className="mt-3 mb-0 pl-4 type-meta text-[var(--color-muted)] space-y-1">
                {currentPerks.map((perk) => (
                  <li key={perk}>{perk}</li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="stat-card">
          <div className="meta-label flex items-center gap-2">
            <FontAwesomeIcon icon={faGem} /> {t('redeemablePoints')}
          </div>
          <div className="stat-value mt-2">{Number(membership.redeemable_points || 0).toLocaleString()}</div>
          <div className="type-meta mt-1 text-[var(--color-muted)]">
            {t('pointsExpireHint', { date: expiryDateLabel })}
          </div>
        </section>

        <section className="stat-card">
          <div className="meta-label flex items-center gap-2">
            <FontAwesomeIcon icon={faTrophy} /> {t('tierPoints365')}
          </div>
          <div className="stat-value mt-2">{Number(membership.tier_points_365d || 0).toLocaleString()}</div>
          <div className="type-meta mt-1 text-[var(--color-muted)]">{t('tierPointsHint')}</div>
        </section>
      </div>

      <div className="stat-grid auto-fit">
        <section className="stat-card">
          <div className="meta-label">{t('totalSpent')}</div>
          <div className="stat-value mt-2">{formatMMK(membership.total_spent)}</div>
        </section>
        <section className="stat-card">
          <div className="meta-label">{t('loginStreak')}</div>
          <div className="stat-value mt-2">{membership.login_streak || 0}</div>
        </section>
        <section className="stat-card">
          <div className="meta-label">{t('earnRule')}</div>
          <div className="type-small mt-2 text-[var(--color-muted)]">
            {t('earnRuleCopy', { divisor: settings.base_earn_divisor || 10000 })}
          </div>
        </section>
      </div>

      {next ? (
        <section className="stat-card">
          <h2 className="section-heading">
            {t('progressTo', { tier: t(next.name) })}
          </h2>
          <p className="type-small text-[var(--color-muted)] mt-1">
            {t('earnMoreTierPoints', {
              points: Number(next.remaining || 0).toLocaleString(),
              tier: t(next.name),
            })}
          </p>
          {Number(next.estimated_spend_mmk || 0) > 0 && (
            <p className="type-small text-[var(--color-ink)] mt-2 mb-0 font-medium">
              {t('tierSpendCoach', {
                amount: formatMMK(next.estimated_spend_mmk),
                tier: t(next.name),
                multiplier: next.at_multiplier || membership.earn_multiplier,
              })}
            </p>
          )}
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
          <div className="type-meta mt-2 text-[var(--color-muted)]">
            {t('progressPercent', { percent: next.progress })}
          </div>
        </section>
      ) : (
        <section className="stat-card">
          <h2 className="section-heading flex items-center gap-2">
            <FontAwesomeIcon icon={faGem} className="text-[var(--color-primary)]" />
            {t('diamondStatus')}
          </h2>
          <p className="type-small text-[var(--color-muted)] mt-1">{t('highestTier')}</p>
        </section>
      )}

      <section className="stat-card">
        <h2 className="section-heading flex items-center gap-2 mb-2">
          <FontAwesomeIcon icon={faCircleInfo} className="text-[var(--color-primary)]" />
          {t('howPointsWork')}
        </h2>
        <ul className="m-0 pl-5 type-small text-[var(--color-muted)] space-y-2">
          <li>{t('howPointsWallet')}</li>
          <li>{t('howPointsTier')}</li>
          <li>{t('howPointsExpire')}</li>
        </ul>
      </section>

      <section className="stat-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="section-heading">{t('tierBenefits')}</h2>
          <div className="toolbar-row">
            <Link to="/app/rewards" className="btn btn-ghost">{t('rewardsCatalog')}</Link>
            <Link to="/app/missions" className="btn btn-ghost">{t('missions')}</Link>
            <Link to="/app/points" className="btn btn-ghost">{t('pointsActivity')}</Link>
          </div>
        </div>
        <div className="space-y-2">
          {Object.entries(membership.tiers || {}).map(([name, cfg]) => (
            <div
              key={name}
              className="tier-perk-row flex flex-wrap items-start justify-between gap-2 border-b border-[var(--color-line)] py-2"
            >
              <div>
                <span className={`tier-pill tier-${name}`}>{t(name)}</span>
                {Array.isArray(cfg.perks) && cfg.perks.length > 0 && (
                  <div className="type-meta text-[var(--color-muted)] mt-1">
                    {cfg.perks.join(' · ')}
                  </div>
                )}
              </div>
              <span className="type-small text-[var(--color-muted)]">
                {t('tierPerkLine', {
                  points: Number(cfg.min || 0).toLocaleString(),
                  multiplier: cfg.multiplier,
                })}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
