import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLanguage } from '../../context/LanguageContext'
import api, { getErrorMessage } from '../../lib/api'
import { faStar, faUsers } from '../../lib/icons'
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

  function inviteUrl() {
    if (!membership?.referral_code) return ''
    return `${window.location.origin}/signup?ref=${encodeURIComponent(membership.referral_code)}`
  }

  async function shareReferral() {
    if (!membership?.referral_code) return
    const url = inviteUrl()
    const text = t('shareReferralText', { code: membership.referral_code, url })
    try {
      if (navigator.share) {
        await navigator.share({ title: t('brandTitle'), text, url })
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // user cancelled share
    }
  }

  async function copyInviteLink() {
    const url = inviteUrl()
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(t('couldNotCopy'))
    }
  }

  function openWhatsApp() {
    if (!membership?.referral_code) return
    const url = inviteUrl()
    const text = t('shareReferralText', { code: membership.referral_code, url })
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        showBack
        title={t('communityHub')}
        subtitle={t('communityHubCopy')}
        icon={faUsers}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <section className="stat-card invite-card">
        <div className="invite-card-intro">
          <h2 className="section-heading m-0">{t('inviteFriends')}</h2>
          <p className="type-small text-[var(--color-muted)] m-0">{t('inviteFriendsCopy')}</p>
        </div>
        <div className="invite-card-code">
          <div className="stat-value tracking-wide m-0">{membership?.referral_code || '—'}</div>
          <p className="type-meta text-[var(--color-muted)] m-0 break-all">{inviteUrl() || '—'}</p>
        </div>
        <div className="invite-card-actions">
          <button type="button" className="btn btn-primary" onClick={shareReferral} disabled={!membership?.referral_code}>
            {copied ? t('copied') : t('shareReferral')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={copyInviteLink} disabled={!membership?.referral_code}>
            {t('copyInviteLink')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={openWhatsApp} disabled={!membership?.referral_code}>
            {t('shareWhatsApp')}
          </button>
        </div>
      </section>

      <section className="stat-card community-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-heading m-0 flex items-center gap-2">
            <FontAwesomeIcon icon={faStar} className="text-[var(--color-primary)]" />
            {t('reviews')}
          </h2>
          <Link to="/app/reviews" className="btn btn-ghost">{t('writeReview')}</Link>
        </div>
        <p className="type-small text-[var(--color-muted)] m-0">{t('reviewsCommunityCopy')}</p>
      </section>

      <section className="stat-card community-card">
        <h2 className="section-heading m-0">{t('memberTips')}</h2>
        <ul className="type-small text-[var(--color-muted)] space-y-3 m-0 pl-5">
          <li>{t('tipEarn')}</li>
          <li>{t('tipRedeem')}</li>
          <li>{t('tipTier')}</li>
          <li>{t('tipReview')}</li>
        </ul>
      </section>
    </div>
  )
}
