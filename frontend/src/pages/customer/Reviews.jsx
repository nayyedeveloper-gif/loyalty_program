import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLanguage } from '../../context/LanguageContext'
import api, { getErrorMessage } from '../../lib/api'
import { faFloppyDisk, faGem } from '../../lib/icons'
import PageHeader from '../../components/PageHeader'

const empty = { product_code: '', product_name: '', rating: 5, body: '' }

export default function CustomerReviews() {
  const { t } = useLanguage()
  const [reviews, setReviews] = useState([])
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data } = await api.get('/customer/reviews')
    setReviews(data.reviews || [])
  }

  useEffect(() => {
    load().catch((err) => setError(getErrorMessage(err, t('somethingWrong'))))
  }, [t])

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api.post('/customer/reviews', form)
      setMessage(t('reviewSubmitted'))
      setForm(empty)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title={t('reviews')}
        subtitle={t('reviewsCopy')}
        icon={faGem}
        backTo="/app"
        backLabel={t('backToMembership')}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-ok" role="status">{message}</div>}

      <form onSubmit={onSubmit} className="stat-card space-y-3 max-w-xl">
        <div className="field">
          <label htmlFor="review-code">{t('productCode')}</label>
          <input id="review-code" required value={form.product_code} onChange={(e) => setForm({ ...form, product_code: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="review-name">{t('productName')}</label>
          <input id="review-name" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="review-rating">{t('rating')}</label>
          <select id="review-rating" value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="review-body">{t('reviewBody')}</label>
          <textarea id="review-body" rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
          {busy ? t('saving') : t('submitReview')}
        </button>
      </form>

      <div className="space-y-3">
        {reviews.map((review) => (
          <section key={review.id} className="stat-card">
            <div className="font-semibold">{review.product_name || review.product_code}</div>
            <div className="type-small text-[var(--color-muted)]">{t('rating')}: {review.rating}/5</div>
            <p className="type-small m-0 mt-2">{review.body}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
