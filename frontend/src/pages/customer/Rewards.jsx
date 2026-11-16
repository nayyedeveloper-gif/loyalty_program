import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLanguage } from '../../context/LanguageContext'
import api, { getErrorMessage } from '../../lib/api'
import { faGem, faShoppingBag } from '../../lib/icons'
import PageHeader from '../../components/PageHeader'

export default function CustomerRewards() {
  const { t } = useLanguage()
  const [rewards, setRewards] = useState([])
  const [balance, setBalance] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState(null)

  async function load() {
    const [rewardsRes, membershipRes] = await Promise.all([
      api.get('/customer/rewards'),
      api.get('/customer/membership'),
    ])
    setRewards(rewardsRes.data.rewards || [])
    setBalance(membershipRes.data.membership?.redeemable_points || 0)
  }

  useEffect(() => {
    load().catch((err) => setError(getErrorMessage(err, t('somethingWrong'))))
  }, [t])

  async function redeem(id) {
    setBusyId(id)
    setError('')
    setMessage('')
    try {
      await api.post('/customer/rewards/redeem', { reward_item_id: id })
      setMessage(t('rewardRedeemed'))
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotRedeem')))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title={t('rewardsCatalog')}
        subtitle={t('rewardsBalance', { points: Number(balance).toLocaleString() })}
        icon={faShoppingBag}
        backTo="/app"
        backLabel={t('backToMembership')}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-ok" role="status">{message}</div>}

      <div className="stat-grid auto-fit">
        {rewards.map((item) => (
          <section key={item.id} className="stat-card space-y-3">
            <div className="meta-label">{item.category}</div>
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
              onClick={() => redeem(item.id)}
            >
              {busyId === item.id ? t('saving') : t('redeem')}
            </button>
          </section>
        ))}
      </div>
    </div>
  )
}
