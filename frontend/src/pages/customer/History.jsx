import { useEffect, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import api, { formatMMK, getErrorMessage } from '../../lib/api'
import { faReceipt } from '../../lib/icons'
import PageHeader from '../../components/PageHeader'

export default function CustomerHistory() {
  const { t, lang } = useLanguage()
  const [purchases, setPurchases] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .get('/customer/purchases')
      .then((res) => setPurchases(res.data.purchases.data || []))
      .catch((err) => setError(getErrorMessage(err, t('somethingWrong'))))
      .finally(() => setLoading(false))
  }, [t])

  if (error) return <div className="alert alert-error" role="alert">{error}</div>

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title={t('purchaseHistory')}
        subtitle={t('historySubtitle')}
        icon={faReceipt}
        backTo="/app"
        backLabel={t('backToMembership')}
      />

      <div className="table-wrap is-stackable">
        <table className="data" aria-label={t('purchaseHistory')}>
          <thead>
            <tr>
              <th scope="col">{t('date')}</th>
              <th scope="col">{t('product')}</th>
              <th scope="col">{t('type')}</th>
              <th scope="col">{t('payable')}</th>
              <th scope="col">{t('pointsEarned')}</th>
              <th scope="col">{t('pointsRedeemed')}</th>
              <th scope="col">{t('payment')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="loading-state" role="status" aria-live="polite">{t('loading')}</td>
              </tr>
            )}
            {!loading &&
              purchases.map((p) => (
                <tr key={p.id}>
                  <td data-label={t('date')}>{new Date(p.created_at).toLocaleDateString(lang === 'my' ? 'my-MM' : 'en-GB')}</td>
                  <td data-label={t('product')}>
                    <div className="font-medium">{p.product_name}</div>
                    <div className="type-meta text-[var(--color-muted)]">{p.product_code}</div>
                  </td>
                  <td data-label={t('type')}>{p.product_type}</td>
                  <td data-label={t('payable')}>{formatMMK(p.net_amount)}</td>
                  <td data-label={t('pointsEarned')}>+{p.points_earned}</td>
                  <td data-label={t('pointsRedeemed')}>{Number(p.points_redeemed || 0).toLocaleString()}</td>
                  <td data-label={t('payment')}>{p.payment_method}</td>
                </tr>
              ))}
            {!loading && !purchases.length && (
              <tr>
                <td colSpan={7} className="empty-state">{t('noPurchasesYet')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
