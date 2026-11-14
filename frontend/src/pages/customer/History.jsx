import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLanguage } from '../../context/LanguageContext'
import api, { formatMMK, getErrorMessage } from '../../lib/api'
import { faReceipt } from '../../lib/icons'

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
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <FontAwesomeIcon icon={faReceipt} className="text-[var(--color-primary)]" aria-hidden="true" />
            {t('purchaseHistory')}
          </h1>
          <p className="page-subtitle">{t('historySubtitle')}</p>
        </div>
      </header>

      <div className="table-wrap">
        <table className="data" aria-label={t('purchaseHistory')}>
          <thead>
            <tr>
              <th scope="col">{t('date')}</th>
              <th scope="col">{t('product')}</th>
              <th scope="col">{t('type')}</th>
              <th scope="col">{t('net')}</th>
              <th scope="col">{t('points')}</th>
              <th scope="col">{t('payment')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="loading-state" role="status" aria-live="polite">{t('loading')}</td>
              </tr>
            )}
            {!loading && purchases.map((p) => (
              <tr key={p.id}>
                <td>{new Date(p.created_at).toLocaleDateString(lang === 'my' ? 'my-MM' : 'en-GB')}</td>
                <td>
                  <div className="font-medium">{p.product_name}</div>
                  <div className="text-xs text-[var(--color-muted)]">{p.product_code}</div>
                </td>
                <td>{p.product_type}</td>
                <td>{formatMMK(p.net_amount)}</td>
                <td>+{p.points_earned}</td>
                <td>{p.payment_method}</td>
              </tr>
            ))}
            {!loading && !purchases.length && (
              <tr>
                <td colSpan={6} className="empty-state">{t('noPurchasesYet')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
