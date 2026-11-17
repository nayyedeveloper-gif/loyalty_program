import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLanguage } from '../context/LanguageContext'
import { faStar } from '../lib/icons'

export default function StarRating({
  value = 0,
  onChange,
  readOnly = false,
  size = 'md',
  id,
}) {
  const { t } = useLanguage()
  const [hover, setHover] = useState(0)
  const active = hover || Number(value) || 0
  const interactive = !readOnly && typeof onChange === 'function'

  return (
    <div
      id={id}
      className={`star-rating star-rating-${size}${interactive ? ' is-interactive' : ''}`}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={t('ratingStars', { rating: Number(value) || 0 })}
      onMouseLeave={() => interactive && setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= active
        if (!interactive) {
          return (
            <span
              key={star}
              className={`star-rating-icon${filled ? ' is-filled' : ''}`}
              aria-hidden="true"
            >
              <FontAwesomeIcon icon={faStar} />
            </span>
          )
        }

        return (
          <button
            key={star}
            type="button"
            className={`star-rating-btn${filled ? ' is-filled' : ''}`}
            aria-label={t('ratingStarValue', { rating: star })}
            aria-checked={Number(value) === star}
            role="radio"
            onMouseEnter={() => setHover(star)}
            onFocus={() => setHover(star)}
            onBlur={() => setHover(0)}
            onClick={() => onChange(star)}
          >
            <FontAwesomeIcon icon={faStar} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
