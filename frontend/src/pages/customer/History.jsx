import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLanguage } from '../../context/LanguageContext'
import api, { formatMMK, getErrorMessage } from '../../lib/api'
import { faEye, faReceipt, faStar } from '../../lib/icons'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import PurchaseReceipt from '../../components/PurchaseReceipt'

export default function CustomerHistory() {
  const { t, lang } = useLanguage()
  const [purchases, setPurchases] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [receiptBusy, setReceiptBusy] = useState(false)

  useEffect(() => {
    setLoading(true)
    api
      .get('/customer/purchases')
      .then((res) => setPurchases(res.data.purchases.data || []))
      .catch((err) => setError(getErrorMessage(err, t('somethingWrong'))))
      .finally(() => setLoading(false))
  }, [t])

  async function openReceipt(purchase) {
    setReceiptBusy(true)
    setError('')
    try {
      const { data } = await api.get(`/customer/purchases/${purchase.id}`)
      setSelected(data.purchase)
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setReceiptBusy(false)
    }
  }

  if (error && !purchases.length) {
    return (
      <div className="alert alert-error" role="alert">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        showBack
        title={t('purchaseHistory')}
        subtitle={t('historySubtitle')}
        icon={faReceipt}
      />

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

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
              <th scope="col">{t('status')}</th>
              <th scope="col">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="loading-state" role="status" aria-live="polite">
                  {t('loading')}
                </td>
              </tr>
            )}
            {!loading &&
              purchases.map((p) => (
                <tr key={p.id}>
                  <td data-label={t('date')}>
                    {new Date(p.created_at).toLocaleDateString(lang === 'my' ? 'my-MM' : 'en-GB')}
                  </td>
                  <td data-label={t('product')}>
                    <div className="font-medium">{p.product_name}</div>
                    <div className="type-meta text-[var(--color-muted)]">{p.product_code}</div>
                  </td>
                  <td data-label={t('type')}>{p.product_type}</td>
                  <td data-label={t('payable')}>{formatMMK(p.net_amount)}</td>
                  <td data-label={t('pointsEarned')}>+{p.points_earned}</td>
                  <td data-label={t('pointsRedeemed')}>{Number(p.points_redeemed || 0).toLocaleString()}</td>
                  <td data-label={t('payment')}>{p.payment_method}</td>
                  <td data-label={t('status')}>
                    {p.status === 'cancelled' ? t('purchaseStatusCancelled') : t('purchaseStatusRecorded')}
                  </td>
                  <td data-label={t('actions')}>
                    <div className="action-row">
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon-action"
                        disabled={receiptBusy}
                        onClick={() => openReceipt(p)}
                        aria-label={t('viewReceipt')}
                      >
                        <FontAwesomeIcon icon={faEye} aria-hidden="true" />
                        <span className="btn-tooltip">{t('viewReceipt')}</span>
                      </button>
                      {p.status !== 'cancelled' && (
                        <Link
                          to={`/app/reviews?product_code=${encodeURIComponent(p.product_code || '')}&product_name=${encodeURIComponent(p.product_name || '')}`}
                          className="btn btn-ghost btn-icon-action"
                          aria-label={t('writeReview')}
                        >
                          <FontAwesomeIcon icon={faStar} aria-hidden="true" />
                          <span className="btn-tooltip">{t('writeReview')}</span>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && !purchases.length && (
              <tr>
                <td colSpan={9} className="empty-state">
                  {t('noPurchasesYet')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={t('purchaseSummary')}
      >
        <PurchaseReceipt purchase={selected} />
      </Modal>
    </div>
  )
}
