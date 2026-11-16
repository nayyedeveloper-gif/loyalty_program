import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import api, { formatMMK, getErrorMessage } from '../../lib/api'
import { faGem } from '../../lib/icons'
import PageHeader from '../../components/PageHeader'
import Pagination from '../../components/Pagination'

function redemptionLabel(row, t) {
  const meta = row.meta || {}
  if (row.source === 'catalog') {
    return meta.reward_name || t('redeemSourceCatalog')
  }
  if (row.source === 'purchase') {
    return t('redeemSourcePurchase')
  }
  return row.source
}

function redemptionDetail(row, t) {
  const meta = row.meta || {}
  if (row.source === 'purchase' && meta.offset_mmk != null) {
    return t('redeemOffsetHint', { amount: formatMMK(meta.offset_mmk) })
  }
  if (row.source === 'catalog') {
    return t('redeemSourceCatalog')
  }
  return null
}

export default function PointsActivity() {
  const { t, lang } = useLanguage()
  const [entries, setEntries] = useState([])
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load(nextPage = 1) {
    setLoading(true)
    try {
      const { data } = await api.get('/customer/ledger', { params: { page: nextPage } })
      setEntries(data.ledger.data || [])
      setMeta(data.ledger)
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
  }, [])

  if (error) return <div className="alert alert-error" role="alert">{error}</div>

  const showEmpty = !loading && entries.length === 0

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title={t('redemptionHistory')}
        subtitle={t('redemptionHistoryCopy')}
        icon={faGem}
        backTo="/app"
        backLabel={t('backToMembership')}
      />

      {loading && (
        <div className="table-wrap">
          <div className="loading-state" role="status" aria-live="polite">
            {t('loading')}
          </div>
        </div>
      )}

      {showEmpty && (
        <div className="empty-panel">
          <p className="empty-panel-title">{t('noRedemptionHistory')}</p>
          <p className="empty-panel-copy">{t('noRedemptionHistoryCopy')}</p>
          <Link to="/app/rewards" className="btn btn-primary">
            {t('startRedeeming')}
          </Link>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <>
          <div className="table-wrap is-stackable">
            <table className="data" aria-label={t('redemptionHistory')}>
              <thead>
                <tr>
                  <th scope="col">{t('date')}</th>
                  <th scope="col">{t('redemption')}</th>
                  <th scope="col">{t('pointsRedeemed')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => {
                  const detail = redemptionDetail(row, t)
                  const spent = Math.abs(Number(row.points) || 0)
                  return (
                    <tr key={row.id}>
                      <td data-label={t('date')}>
                        {new Date(row.created_at).toLocaleDateString(lang === 'my' ? 'my-MM' : 'en-GB')}
                      </td>
                      <td data-label={t('redemption')}>
                        <div className="font-medium">{redemptionLabel(row, t)}</div>
                        {detail ? <div className="type-meta text-[var(--color-muted)]">{detail}</div> : null}
                      </td>
                      <td data-label={t('pointsRedeemed')} className="text-rose-600">
                        -{spent.toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination meta={meta} onPageChange={load} />
        </>
      )}
    </div>
  )
}
