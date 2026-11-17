import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLanguage } from '../../context/LanguageContext'
import api, { getErrorMessage } from '../../lib/api'
import { faFloppyDisk, faStar } from '../../lib/icons'
import PageHeader from '../../components/PageHeader'
import StarRating from '../../components/StarRating'

const empty = { product_code: '', product_name: '', rating: 5, body: '' }

export default function CustomerReviews() {
  const { t, lang } = useLanguage()
  const [searchParams] = useSearchParams()
  const [reviews, setReviews] = useState([])
  const [purchases, setPurchases] = useState([])
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [reviewBonus, setReviewBonus] = useState(20)

  const reviewedCodes = useMemo(
    () => new Set(reviews.map((r) => String(r.product_code || '').toUpperCase())),
    [reviews],
  )

  const reviewablePurchases = useMemo(() => {
    const seen = new Set()
    return purchases.filter((p) => {
      const code = String(p.product_code || '').toUpperCase()
      if (!code || reviewedCodes.has(code) || seen.has(code)) return false
      seen.add(code)
      return true
    })
  }, [purchases, reviewedCodes])

  async function load() {
    const [reviewsRes, purchasesRes, membershipRes] = await Promise.all([
      api.get('/customer/reviews'),
      api.get('/customer/purchases', { params: { per_page: 50 } }),
      api.get('/customer/membership'),
    ])
    setReviews(reviewsRes.data.reviews || [])
    setPurchases(purchasesRes.data.purchases?.data || purchasesRes.data.purchases || [])
    const bonus = Number(membershipRes.data.membership?.settings?.review_bonus_points)
    setReviewBonus(Number.isFinite(bonus) && bonus > 0 ? bonus : 20)
  }

  useEffect(() => {
    load()
      .then(() => {
        const code = (searchParams.get('product_code') || '').trim()
        const name = (searchParams.get('product_name') || '').trim()
        if (code) {
          setForm((prev) => ({
            ...prev,
            product_code: code,
            product_name: name || prev.product_name,
          }))
        }
      })
      .catch((err) => setError(getErrorMessage(err, t('somethingWrong'))))
  }, [t, searchParams])

  function pickPurchase(purchaseId) {
    const purchase = reviewablePurchases.find((p) => String(p.id) === String(purchaseId))
    if (!purchase) {
      setForm((prev) => ({ ...prev, product_code: '', product_name: '' }))
      return
    }
    setForm((prev) => ({
      ...prev,
      product_code: purchase.product_code || '',
      product_name: purchase.product_name || '',
    }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api.post('/customer/reviews', form)
      setMessage(t('reviewSubmitted', { points: reviewBonus }))
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
        showBack
        title={t('reviews')}
        subtitle={t('reviewsCopy', { points: reviewBonus })}
        icon={faStar}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-ok" role="status">{message}</div>}

      <form onSubmit={onSubmit} className="stat-card space-y-3 max-w-xl">
        <p className="type-small m-0 flex items-center gap-2 text-[var(--color-muted)]">
          <FontAwesomeIcon icon={faStar} className="text-[var(--color-primary)]" aria-hidden="true" />
          {t('reviewBonusHint', { points: reviewBonus })}
        </p>
        <div className="field">
          <label htmlFor="review-purchase">{t('reviewFromPurchase')}</label>
          <select
            id="review-purchase"
            value={
              reviewablePurchases.find(
                (p) => String(p.product_code).toUpperCase() === String(form.product_code).toUpperCase(),
              )?.id || ''
            }
            onChange={(e) => pickPurchase(e.target.value)}
          >
            <option value="">{t('selectPurchaseOptional')}</option>
            {reviewablePurchases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.product_name} · {p.product_code}
              </option>
            ))}
          </select>
          <p className="type-meta text-[var(--color-muted)] m-0 mt-1">{t('reviewFromPurchaseHint')}</p>
        </div>
        <div className="field">
          <label htmlFor="review-code">{t('productCode')}</label>
          <input
            id="review-code"
            required
            value={form.product_code}
            onChange={(e) => setForm({ ...form, product_code: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="review-name">{t('productName')}</label>
          <input
            id="review-name"
            value={form.product_name}
            onChange={(e) => setForm({ ...form, product_name: e.target.value })}
          />
        </div>
        <div className="field">
          <label id="review-rating-label">{t('rating')}</label>
          <StarRating
            id="review-rating"
            value={form.rating}
            onChange={(rating) => setForm({ ...form, rating })}
          />
        </div>
        <div className="field">
          <label htmlFor="review-body">{t('reviewBody')}</label>
          <textarea
            id="review-body"
            rows={4}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
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
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <StarRating value={review.rating} readOnly size="sm" />
              <span className="type-meta text-[var(--color-muted)]">
                {new Date(review.created_at).toLocaleDateString(lang === 'my' ? 'my-MM' : 'en-GB')}
              </span>
            </div>
            {review.body ? <p className="type-small m-0 mt-2">{review.body}</p> : null}
          </section>
        ))}
        {!reviews.length && (
          <p className="type-meta text-[var(--color-muted)]">{t('noReviewsYet')}</p>
        )}
      </div>
    </div>
  )
}
