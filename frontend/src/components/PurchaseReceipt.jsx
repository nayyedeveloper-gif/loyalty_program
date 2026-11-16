import { useLanguage } from '../context/LanguageContext'
import { formatMMK } from '../lib/api'

export default function PurchaseReceipt({ purchase }) {
  const { t, lang } = useLanguage()
  if (!purchase) return null

  const snapshot = purchase.earn_snapshot || {}
  const redeemedPts = Number(purchase.points_redeemed || 0)
  const offset = Number(purchase.amount_offset_mmk || 0)
  const earned = Number(purchase.points_earned || snapshot.points_earned || 0)
  const hasMultipliers =
    snapshot.tier_multiplier != null || snapshot.promo_multiplier != null || snapshot.base_points != null

  const cancelled = purchase.status === 'cancelled'

  return (
    <div className="space-y-4">
      <div className="type-small text-[var(--color-muted)] space-y-1">
        <div>
          {t('purchaseReference')}: <strong>PUR-{purchase.id}</strong>
          {cancelled ? ` · ${t('purchaseStatusCancelled')}` : ''}
        </div>
        <div>{new Date(purchase.created_at).toLocaleString(lang === 'my' ? 'my-MM' : 'en-GB')}</div>
        <div>
          {purchase.product_name}
          {purchase.product_code ? ` · ${purchase.product_code}` : ''}
        </div>
        <div>{purchase.payment_method}</div>
        {cancelled && purchase.cancel_reason ? (
          <div>
            {t('cancelReason')}: {purchase.cancel_reason}
          </div>
        ) : null}
      </div>

      <dl className="receipt-rows">
        <div>
          <dt>{t('jewelleryPurchase')}</dt>
          <dd>{formatMMK(purchase.amount)}</dd>
        </div>
        {redeemedPts > 0 && (
          <div>
            <dt>
              {t('pointsRedeemedValue')} ({redeemedPts.toLocaleString()} pts)
            </dt>
            <dd className="text-rose-600">-{formatMMK(offset)}</dd>
          </div>
        )}
        <div>
          <dt>{t('payableAmount')}</dt>
          <dd>{formatMMK(purchase.net_amount)}</dd>
        </div>
        <div>
          <dt>{t('pointsEarned')}</dt>
          <dd className="text-emerald-600">+{earned.toLocaleString()}</dd>
        </div>
      </dl>

      {hasMultipliers && (
        <dl className="receipt-rows">
          {snapshot.tier_at_purchase && (
            <div>
              <dt>{t('tierAtPurchase')}</dt>
              <dd>{t(snapshot.tier_at_purchase)}</dd>
            </div>
          )}
          {snapshot.base_points != null && (
            <div>
              <dt>{t('basePoints')}</dt>
              <dd>{Number(snapshot.base_points).toLocaleString()}</dd>
            </div>
          )}
          {snapshot.tier_multiplier != null && (
            <div>
              <dt>{t('multiplierApplied')}</dt>
              <dd>
                {Number(snapshot.tier_multiplier)}×
                {snapshot.promo_multiplier != null && Number(snapshot.promo_multiplier) !== 1
                  ? ` · ${t('promo')} ${Number(snapshot.promo_multiplier)}×`
                  : ''}
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  )
}
