import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import api, { formatMMK, getErrorMessage } from '../../lib/api'
import { faGem } from '../../lib/icons'
import PageHeader from '../../components/PageHeader'
import Pagination from '../../components/Pagination'

const FILTERS = [
  { value: '', key: 'activityAll' },
  { value: 'earn', key: 'activityEarned' },
  { value: 'redeem', key: 'activityRedeemed' },
  { value: 'bonus', key: 'activityBonus' },
  { value: 'expire', key: 'activityExpired' },
  { value: 'adjustments', key: 'activityAdjustments' },
]

function activityLabel(row, t) {
  const meta = row.meta || {}
  const type = row.type
  const source = row.source

  if (type === 'earn' && source === 'purchase') return t('activityPurchaseEarn')
  if (type === 'redeem' && source === 'catalog') {
    return meta.reward_name ? t('activityCatalogRedeemNamed', { name: meta.reward_name }) : t('activityCatalogRedeem')
  }
  if (type === 'redeem' && source === 'purchase') return t('activityPurchaseRedeem')
  if (type === 'bonus' && source === 'signup') return t('activitySignupBonus')
  if (type === 'bonus' && source === 'referral') return t('activityReferralBonus')
  if (type === 'bonus' && source === 'review') return t('activityReviewBonus')
  if (type === 'bonus' && source === 'mission') return t('activityMissionBonus')
  if (type === 'bonus') return t('activityBonusGeneric')
  if (type === 'expire') return t('activityExpiredPoints')
  if (type === 'adjust') return meta.reason || t('activityAdjustment')
  if (type === 'reverse') return t('activityReversal')
  return `${type} · ${source}`
}

function activityDetail(row, t) {
  const meta = row.meta || {}
  if (row.type === 'redeem' && row.source === 'purchase' && meta.offset_mmk != null) {
    return t('redeemOffsetHint', { amount: formatMMK(meta.offset_mmk) })
  }
  if (row.type === 'earn' && row.source === 'purchase') {
    const parts = []
    if (meta.tier_multiplier != null) parts.push(`${meta.tier_multiplier}×`)
    if (meta.promo_multiplier != null && Number(meta.promo_multiplier) !== 1) {
      parts.push(`${t('promo')}: ${meta.promo_multiplier}×`)
    }
    return parts.length ? parts.join(' · ') : null
  }
  if (row.type === 'expire' && meta.reason === 'inactivity') {
    return t('activityExpireInactivity')
  }
  return null
}

export default function PointsActivity() {
  const { t, lang } = useLanguage()
  const [entries, setEntries] = useState([])
  const [meta, setMeta] = useState(null)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load(nextPage = 1, nextFilter = filter) {
    setLoading(true)
    try {
      const { data } = await api.get('/customer/ledger', {
        params: {
          page: nextPage,
          type: nextFilter || undefined,
          per_page: 20,
        },
      })
      setEntries(data.ledger.data || [])
      setMeta(data.ledger)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1, filter)
  }, [filter])

  const showEmpty = !loading && entries.length === 0

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        showBack
        title={t('pointsActivity')}
        subtitle={t('pointsActivityCopy')}
        icon={faGem}
      />

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <form
        className="filter-bar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          load(1, filter)
        }}
      >
        <label className="sr-only" htmlFor="activity-filter">
          {t('activity')}
        </label>
        <select
          id="activity-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {FILTERS.map((item) => (
            <option key={item.value || 'all'} value={item.value}>
              {t(item.key)}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-ghost">
          {t('search')}
        </button>
      </form>

      {loading && (
        <div className="table-wrap">
          <div className="loading-state" role="status" aria-live="polite">
            {t('loading')}
          </div>
        </div>
      )}

      {showEmpty && (
        <div className="empty-panel">
          <p className="empty-panel-title">{t('noPointsActivity')}</p>
          <p className="empty-panel-copy">{t('noPointsActivityCopy')}</p>
          <div className="toolbar-row">
            <Link to="/app/history" className="btn btn-ghost">
              {t('purchaseHistory')}
            </Link>
            <Link to="/app/rewards" className="btn btn-primary">
              {t('startRedeeming')}
            </Link>
          </div>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <>
          <div className="table-wrap is-stackable">
            <table className="data" aria-label={t('pointsActivity')}>
              <thead>
                <tr>
                  <th scope="col">{t('date')}</th>
                  <th scope="col">{t('activity')}</th>
                  <th scope="col">{t('points')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => {
                  const pts = Number(row.points) || 0
                  const detail = activityDetail(row, t)
                  return (
                    <tr key={row.id}>
                      <td data-label={t('date')}>
                        {new Date(row.created_at).toLocaleDateString(lang === 'my' ? 'my-MM' : 'en-GB')}
                      </td>
                      <td data-label={t('activity')}>
                        <div className="font-medium">{activityLabel(row, t)}</div>
                        {detail ? <div className="type-meta text-[var(--color-muted)]">{detail}</div> : null}
                      </td>
                      <td
                        data-label={t('points')}
                        className={pts >= 0 ? 'text-emerald-600' : 'text-rose-600'}
                      >
                        {pts > 0 ? '+' : ''}
                        {pts.toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination meta={meta} onPageChange={(page) => load(page, filter)} />
        </>
      )}
    </div>
  )
}
