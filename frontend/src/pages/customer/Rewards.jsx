import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ConfirmModal from '../../components/ConfirmModal'
import PageHeader from '../../components/PageHeader'
import { useLanguage } from '../../context/LanguageContext'
import api, { getErrorMessage, mediaUrl } from '../../lib/api'
import { faBan, faGem, faShoppingBag } from '../../lib/icons'

export default function CustomerRewards() {
  const { t, lang } = useLanguage()
  const [rewards, setRewards] = useState([])
  const [redemptions, setRedemptions] = useState([])
  const [balance, setBalance] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [lastCode, setLastCode] = useState('')
  const [lastInstant, setLastInstant] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [redeemTarget, setRedeemTarget] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  async function load() {
    const [rewardsRes, membershipRes, redemptionsRes] = await Promise.all([
      api.get('/customer/rewards'),
      api.get('/customer/membership'),
      api.get('/customer/redemptions', { params: { per_page: 10 } }),
    ])
    setRewards(rewardsRes.data.rewards || [])
    setBalance(membershipRes.data.membership?.redeemable_points || 0)
    setRedemptions(redemptionsRes.data.redemptions?.data || [])
  }

  useEffect(() => {
    load().catch((err) => setError(getErrorMessage(err, t('somethingWrong'))))
  }, [t])

  function isInstantReward(item) {
    return (item?.fulfillment || (item?.category === 'partner' ? 'instant' : 'pickup')) === 'instant'
  }

  async function confirmRedeem() {
    if (!redeemTarget) return
    setConfirmBusy(true)
    setBusyId(redeemTarget.id)
    setError('')
    setMessage('')
    setLastCode('')
    setLastInstant(false)
    try {
      const { data } = await api.post('/customer/rewards/redeem', { reward_item_id: redeemTarget.id })
      const instant = isInstantReward(data.redemption?.reward_item || redeemTarget)
      setLastInstant(instant)
      setMessage(instant ? t('rewardRedeemedInstant') : t('rewardRedeemedPickup'))
      setLastCode(data.redemption?.redemption_code || '')
      setRedeemTarget(null)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotRedeem')))
    } finally {
      setConfirmBusy(false)
      setBusyId(null)
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return
    setConfirmBusy(true)
    setError('')
    setMessage('')
    try {
      const { data } = await api.post(`/customer/redemptions/${cancelTarget.id}/cancel`)
      setMessage(data.message || t('redemptionCancelledRefund'))
      setCancelTarget(null)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotCancelRedemption')))
    } finally {
      setConfirmBusy(false)
    }
  }

  function statusLabel(item) {
    if (item.status === 'pending') return t('redemptionPending')
    if (item.status === 'collected') {
      return isInstantReward(item.reward_item) ? t('redemptionDelivered') : t('redemptionCollected')
    }
    if (item.status === 'cancelled') return t('redemptionCancelled')
    return item.status
  }

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        showBack
        title={t('rewardsCatalog')}
        subtitle={t('rewardsBalance', { points: Number(balance).toLocaleString() })}
        icon={faShoppingBag}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && (
        <div className="alert alert-ok" role="status">
          {message}
          {lastCode && !lastInstant ? (
            <div className="type-small mt-1">
              {t('redemptionCode')}: <strong className="tracking-wide">{lastCode}</strong>
              {' — '}
              {t('presentRedemptionCode')}
            </div>
          ) : null}
        </div>
      )}

      <div className="stat-grid auto-fit">
        {rewards.map((item) => (
          <section key={item.id} className="stat-card space-y-3">
            <div className="reward-card-media" aria-hidden="true">
              {item.image_url ? (
                <img src={mediaUrl(item.image_url)} alt="" />
              ) : (
                <FontAwesomeIcon icon={faShoppingBag} />
              )}
            </div>
            <div className="meta-label capitalize">
              {item.category}
              {isInstantReward(item) ? ` · ${t('fulfillmentInstant')}` : ` · ${t('fulfillmentPickup')}`}
            </div>
            <h2 className="section-heading">{item.name}</h2>
            <p className="type-small text-[var(--color-muted)] m-0">{item.description}</p>
            <div className="type-small flex items-center gap-2">
              <FontAwesomeIcon icon={faGem} className="text-[var(--color-primary)]" />
              {Number(item.points_cost).toLocaleString()} {t('points')}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busyId === item.id || balance < item.points_cost}
              onClick={() => setRedeemTarget(item)}
            >
              {busyId === item.id ? t('saving') : t('redeem')}
            </button>
          </section>
        ))}
      </div>

      {!rewards.length && (
        <div className="empty-panel">
          <p className="empty-panel-title">{t('noRewardsFound')}</p>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="section-heading">{t('myRedemptions')}</h2>
        <div className="table-wrap is-stackable">
          <table className="data" aria-label={t('myRedemptions')}>
            <thead>
              <tr>
                <th scope="col">{t('date')}</th>
                <th scope="col">{t('reward')}</th>
                <th scope="col">{t('redemptionCode')}</th>
                <th scope="col">{t('status')}</th>
                <th scope="col" className="col-actions">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map((item) => (
                <tr key={item.id}>
                  <td data-label={t('date')}>
                    {new Date(item.created_at).toLocaleDateString(lang === 'my' ? 'my-MM' : 'en-GB')}
                  </td>
                  <td data-label={t('reward')}>{item.reward_item?.name || '—'}</td>
                  <td data-label={t('redemptionCode')}>
                    <span className="font-medium tracking-wide">{item.redemption_code || '—'}</span>
                  </td>
                  <td data-label={t('status')}>{statusLabel(item)}</td>
                  <td data-label={t('actions')} className="col-actions">
                    <div className="action-row">
                      {item.status === 'pending' ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon-action"
                          onClick={() => setCancelTarget(item)}
                          aria-label={t('cancelRedemption')}
                        >
                          <FontAwesomeIcon icon={faBan} aria-hidden="true" />
                          <span className="btn-tooltip">{t('cancelRedemption')}</span>
                        </button>
                      ) : (
                        <span className="action-placeholder" aria-hidden="true">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!redemptions.length && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    {t('noRedemptionsFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmModal
        open={!!redeemTarget}
        title={t('confirmRedeemTitle')}
        message={
          isInstantReward(redeemTarget)
            ? t('confirmRedeemInstant', {
                name: redeemTarget?.name || '',
                points: Number(redeemTarget?.points_cost || 0).toLocaleString(),
              })
            : t('confirmRedeemPickup', {
                name: redeemTarget?.name || '',
                points: Number(redeemTarget?.points_cost || 0).toLocaleString(),
              })
        }
        confirmLabel={t('redeem')}
        danger={false}
        busy={confirmBusy}
        onCancel={() => setRedeemTarget(null)}
        onConfirm={confirmRedeem}
      />

      <ConfirmModal
        open={!!cancelTarget}
        title={t('confirmCancelRedemptionTitle')}
        message={t('confirmCancelRedemption', {
          name: cancelTarget?.reward_item?.name || '',
          points: Number(cancelTarget?.points_spent || 0).toLocaleString(),
        })}
        confirmLabel={t('cancelRedemption')}
        danger
        confirmIcon={faBan}
        busy={confirmBusy}
        onCancel={() => setCancelTarget(null)}
        onConfirm={confirmCancel}
      />
    </div>
  )
}
