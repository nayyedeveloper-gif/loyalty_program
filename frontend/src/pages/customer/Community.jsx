import { useEffect, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import api, { getErrorMessage } from '../../lib/api'
import { faUsers } from '../../lib/icons'
import PageHeader from '../../components/PageHeader'

export default function CustomerCommunity() {
  const { t } = useLanguage()
  const [membership, setMembership] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/customer/membership')
      .then((res) => setMembership(res.data.membership))
      .catch((err) => setError(getErrorMessage(err, t('somethingWrong'))))
  }, [t])

  async function shareReferral() {
    if (!membership?.referral_code) return
    const text = t('shareReferralText', { code: membership.referral_code })
    try {
      if (navigator.share) {
        await navigator.share({ title: t('brandTitle'), text })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // user cancelled share
    }
  }

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title={t('communityHub')}
        subtitle={t('communityHubCopy')}
        icon={faUsers}
        backTo="/app"
        backLabel={t('backToMembership')}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <section className="stat-card space-y-3">
        <h2 className="section-heading">{t('inviteFriends')}</h2>
        <p className="type-small text-[var(--color-muted)] m-0">{t('inviteFriendsCopy')}</p>
        <div className="stat-value tracking-wide">{membership?.referral_code || '—'}</div>
        <button type="button" className="btn btn-primary" onClick={shareReferral} disabled={!membership?.referral_code}>
          {copied ? t('copied') : t('shareReferral')}
        </button>
      </section>

      <section className="stat-card space-y-2">
        <h2 className="section-heading">{t('memberTips')}</h2>
        <ul className="type-small text-[var(--color-muted)] space-y-2 m-0 pl-5">
          <li>{t('tipEarn')}</li>
          <li>{t('tipRedeem')}</li>
          <li>{t('tipTier')}</li>
          <li>{t('tipReview')}</li>
        </ul>
      </section>
    </div>
  )
}
