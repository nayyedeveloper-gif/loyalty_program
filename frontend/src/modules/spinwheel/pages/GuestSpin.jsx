import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import LanguageSwitcher from '../../../components/LanguageSwitcher'
import { useLanguage } from '../../../context/LanguageContext'
import api, { getErrorMessage } from '../../../lib/api'
import { mediaUrl } from '../lib/media'
import { useLiveWheelSync } from '../lib/useLiveWheelSync'
import SpinWheel from '../components/SpinWheel'
import BrandMark from '../components/BrandMark'
import Title from '../components/Title'
import { ConfirmDialog, Modal, Skeleton, StatusBadge } from '../components/ui'
import '../styles/fonts.css'
import '../styles/spinwheel.css'

function sessionStorageKey(token) {
  return token ? `guest_spin_session_${token}` : 'guest_spin_session'
}

function pendingKey(reference) {
  return `pending_guest_spin_${reference || 'unknown'}`
}

function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/** Deduplicate concurrent activate calls for the same link (React Strict Mode remounts). */
const activateInFlight = new Map()

async function postActivate(token, guestSessionToken, fallbackMessage) {
  try {
    const { data } = await api.post(`/spinwheel/guest/${encodeURIComponent(token)}/activate`, {
      guest_session_token: guestSessionToken || undefined,
    })
    return { ...data, ok: true }
  } catch (err) {
    const data = err?.response?.data || {}
    return {
      ...data,
      ok: false,
      message: data.message || getErrorMessage(err, fallbackMessage),
    }
  }
}

async function activateGuestLink(token, fallbackMessage) {
  const existing = activateInFlight.get(token)
  if (existing) return existing

  const run = (async () => {
    const sessionBefore = localStorage.getItem(sessionStorageKey(token)) || undefined
    let data = await postActivate(token, sessionBefore, fallbackMessage)

    if (data.guest_session_token) {
      localStorage.setItem(sessionStorageKey(token), data.guest_session_token)
    }

    // Sibling request may have reserved first; reclaim with the session it stored.
    if (!data.ok && data.status === 'reserved' && !data.wheel) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const stored = localStorage.getItem(sessionStorageKey(token)) || undefined
        if (!stored || stored === sessionBefore) {
          await new Promise((r) => setTimeout(r, 40 * (attempt + 1)))
          continue
        }
        data = await postActivate(token, stored, fallbackMessage)
        if (data.guest_session_token) {
          localStorage.setItem(sessionStorageKey(token), data.guest_session_token)
        }
        break
      }
    }

    return data
  })().finally(() => {
    activateInFlight.delete(token)
  })

  activateInFlight.set(token, run)
  return run
}

function WinSuccessMark() {
  return (
    <div className="win-success-mark" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </div>
  )
}

function GuestStatusCard({ title, body, brandTitle, logoUrl, used, t }) {
  return (
    <main className="cx-shell guest-shell">
      <div className="cx-header-tools" style={{ justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <LanguageSwitcher compact />
      </div>
      <section className="cx-card" style={{ marginTop: '0.5rem', textAlign: 'center' }}>
        <BrandMark title={brandTitle} logoUrl={logoUrl} centered />
        <p className="cx-kicker" style={{ marginTop: '1rem' }}>{t('spinGuestKicker')}</p>
        <h2 className="cx-title" style={{ fontSize: '2.2rem' }}>{title}</h2>
        <p className="cx-copy">{body}</p>
        {used ? (
          <p className="cx-copy" style={{ marginTop: '1.25rem' }}>
            {t('spinGuestUsedHint')}{' '}
            <a href="/signup">{t('spinGuestCreateAccount')}</a>
            {' / '}
            <a href="/signin">{t('spinGuestSignIn')}</a>
          </p>
        ) : null}
      </section>
    </main>
  )
}

export default function GuestSpin() {
  const { t } = useLanguage()
  const { token } = useParams()
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [state, setState] = useState(null)
  const [sessionToken, setSessionToken] = useState('')
  const [spinning, setSpinning] = useState(false)
  const [confirmSpin, setConfirmSpin] = useState(false)
  const [result, setResult] = useState(null)
  const [showWin, setShowWin] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [error, setError] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const wheelRef = useRef(null)
  const spinLock = useRef(false)

  const presentResult = async (data, { animate } = { animate: true }) => {
    const index = Number(data.segment_index)
    if (animate && Number.isInteger(index) && index >= 0) {
      await wheelRef.current?.spinToIndex(index)
    }
    setResult(data.result)
    setHighlightIndex(Number.isInteger(index) ? index : null)
    setShowConfetti(true)
    setShowWin(true)
    setState((s) => (s ? {
      ...s,
      spins_remaining: 0,
      result: data.result,
      status: 'used',
      wheel: s.wheel || data.wheel,
    } : s))
    setStatus('used')
  }

  const activate = useCallback(async (cancelled) => {
    setStatus('loading')
    setError('')
    try {
      if (!token) {
        setStatus('unavailable')
        setMessage(t('spinGuestLinkUnavailable'))
        return
      }

      const data = await activateGuestLink(token, t('spinGuestLinkUnavailable'))
      if (cancelled?.()) return

      if (data.guest_session_token) {
        setSessionToken(data.guest_session_token)
      }

      if (!data.ok && !data.status) {
        setStatus('unavailable')
        setMessage(data.message || t('spinGuestLinkUnavailable'))
        return
      }

      setState(data)
      setStatus(data.status || (data.ok ? 'reserved' : 'unavailable'))
      setMessage(data.message || '')

      if (data.status === 'used' && data.result) {
        setResult(data.result)
        setShowWin(true)
      }

      // Reserved by another browser/tab — not recoverable here.
      if (data.status === 'reserved' && !data.wheel) {
        return
      }

      const key = localStorage.getItem(pendingKey(data.reference))
      if (key && data.status === 'reserved' && data.guest_session_token) {
        try {
          const { data: recovered } = await api.post('/spinwheel/guest/spin', {
            guest_session_token: data.guest_session_token,
            idempotency_key: key,
          })
          if (cancelled?.()) return
          await presentResult(recovered, { animate: false })
          localStorage.removeItem(pendingKey(data.reference))
        } catch {
          /* keep pending until confirm */
        }
      }
    } catch (err) {
      if (cancelled?.()) return
      setStatus('unavailable')
      setMessage(getErrorMessage(err, t('spinGuestLinkUnavailable')))
    }
  }, [token, t])

  useEffect(() => {
    let cancelled = false
    activate(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [activate])

  useEffect(() => {
    if (!showConfetti) return undefined
    const t = setTimeout(() => setShowConfetti(false), 2000)
    return () => clearTimeout(t)
  }, [showConfetti])

  const applyLiveWheel = useCallback((wheel) => {
    setState((prev) => (prev ? { ...prev, wheel } : prev))
  }, [])

  useLiveWheelSync({
    enabled: status === 'reserved' && !spinning && !showWin,
    onWheelChange: applyLiveWheel,
  })

  const spin = async () => {
    if (spinLock.current || spinning || !sessionToken || state?.spins_remaining !== 1) return
    spinLock.current = true
    setConfirmSpin(false)
    setSpinning(true)
    setError('')

    const key = localStorage.getItem(pendingKey(state?.reference)) || newIdempotencyKey()
    localStorage.setItem(pendingKey(state?.reference), key)

    try {
      const { data } = await api.post('/spinwheel/guest/spin', {
        guest_session_token: sessionToken,
        idempotency_key: key,
      })
      await presentResult(data, { animate: true })
      localStorage.removeItem(pendingKey(state?.reference))
    } catch (err) {
      setError(getErrorMessage(err, t('spinUnableSpin')))
      try {
        const { data } = await api.post('/spinwheel/guest/spin', {
          guest_session_token: sessionToken,
          idempotency_key: key,
        })
        await presentResult(data, { animate: true })
        localStorage.removeItem(pendingKey(state?.reference))
      } catch {
        /* still pending */
      }
    } finally {
      setSpinning(false)
      spinLock.current = false
    }
  }

  const segments = state?.wheel?.segments || []
  const canSpin = status === 'reserved' && state?.spins_remaining === 1 && !spinning
  const isMajor = result?.tier === 'major'
  const displayResult = result || state?.result

  const confettiPieces = useMemo(
    () => Array.from({ length: 42 }).map((_, i) => ({
      left: `${(i * 9 + 4) % 100}%`,
      delay: `${(i % 12) * 0.05}s`,
      color: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe', '#ffffff'][i % 6],
      w: 6 + (i % 4),
      h: 10 + (i % 5),
    })),
    [],
  )

  const heroTitle = state?.wheel?.page_title || state?.wheel?.name || t('spinDefaultTitle')
  const heroCopy = state?.wheel?.subtitle || t('spinGuestDefaultCopy')
  const spinsLeft = state?.spins_remaining ?? 0

  if (status === 'loading') {
    return (
      <main className="cx-shell guest-shell">
        <div className="cx-header-tools" style={{ justifyContent: 'flex-end' }}>
          <LanguageSwitcher compact />
        </div>
        <section className="cx-card wheel-panel" style={{ marginTop: '1rem' }}>
          <Skeleton height={280} radius={999} width="min(360px, 80%)" />
          <p className="hint">{t('spinGuestPreparing')}</p>
        </section>
      </main>
    )
  }

  if (['unavailable', 'revoked', 'expired'].includes(status) || (status === 'used' && !displayResult)) {
    const used = status === 'used'
    return (
      <GuestStatusCard
        t={t}
        title={used ? t('spinGuestUsedTitle') : t('spinGuestUnavailableTitle')}
        body={message || (used ? t('spinGuestUsedBody') : t('spinGuestUnavailableBody'))}
        brandTitle={state?.wheel?.brand_title}
        logoUrl={state?.wheel?.logo_url || state?.wheel?.logo_path}
        used={used}
      />
    )
  }

  if (status === 'reserved' && !state?.wheel) {
    return (
      <GuestStatusCard
        t={t}
        title={t('spinGuestInUseTitle')}
        body={message || t('spinGuestInUseBody')}
        brandTitle={state?.wheel?.brand_title}
        logoUrl={state?.wheel?.logo_url || state?.wheel?.logo_path}
      />
    )
  }

  return (
    <main className="cx-shell guest-shell">
      <header className="cx-header">
        <BrandMark
          title={state?.wheel?.brand_title || state?.wheel?.name}
          logoUrl={state?.wheel?.logo_url || state?.wheel?.logo_path}
          subtitle={t('spinGuestSubtitle')}
        />
        <div className="cx-header-tools">
          <LanguageSwitcher compact />
          <span className="spin-chip">
            {spinsLeft === 1 ? t('spinChipOne', { count: spinsLeft }) : t('spinChipCount', { count: spinsLeft })}
          </span>
        </div>
      </header>

      <AnimatePresence>
        {error && (
          <motion.div className="toast toast-err" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <section className="cx-card wheel-panel spin-stage">
        <Title title={heroTitle} onHelp={() => setShowHelp(true)} />
        <p className="spin-hero-copy">{heroCopy}</p>

        {showConfetti && (
          <>
            <div className="burst" aria-hidden />
            <div className="confetti" aria-hidden>
              {confettiPieces.map((p, i) => (
                <i
                  key={i}
                  style={{
                    left: p.left,
                    animationDelay: p.delay,
                    background: p.color,
                    width: p.w,
                    height: p.h,
                  }}
                />
              ))}
            </div>
          </>
        )}

        <SpinWheel
          ref={wheelRef}
          segments={segments}
          idle={!spinning && !displayResult}
          highlightIndex={highlightIndex}
          celebrating={!!displayResult && showWin}
        />

        <div className="cx-stat-row spin-stats">
          <div className="cx-stat">
            <strong>{state?.spins_remaining ?? 0}</strong>
            <span>{t('spinAvailable')}</span>
          </div>
          <div className="cx-stat">
            <strong>{displayResult ? 1 : 0}</strong>
            <span>{t('spinRewardsWon')}</span>
          </div>
        </div>

        {state?.reference && (
          <p className="hint" style={{ marginTop: '0.65rem' }}>
            {t('spinGuestReference')}{' '}
            <strong style={{ color: 'var(--cx-ink)' }}>{state.reference}</strong>
          </p>
        )}

        <div className="spin-cta-wrap">
          {canSpin && (
            <motion.button
              type="button"
              className={`btn-spin ${spinning ? 'is-loading' : ''}`}
              disabled={!canSpin}
              onClick={() => setConfirmSpin(true)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              {spinning ? t('spinSpinning') : t('spinNow')}
            </motion.button>
          )}

          {canSpin && (
            <span className="spins-remaining-pill" aria-live="polite">
              {t('spinRemainingOne', { count: 1 })}
            </span>
          )}

          {status === 'used' && displayResult && (
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <p><StatusBadge status={displayResult.display_status} label={displayResult.status_label} /></p>
              <p style={{ marginTop: 8 }}>
                {t('spinReference')}{' '}
                <strong style={{ color: 'var(--cx-ink)' }}>{displayResult.reward_code}</strong>
              </p>
              <button
                type="button"
                className="btn-spin"
                style={{ marginTop: 12, minWidth: 160 }}
                onClick={() => setShowWin(true)}
              >
                {t('spinGuestViewPrize')}
              </button>
            </div>
          )}
        </div>
      </section>

      <Modal open={showHelp} onClose={() => setShowHelp(false)}>
        <p className="cx-kicker">{t('spinHelp')}</p>
        <h2 className="cx-title" style={{ fontSize: '1.7rem' }}>{t('spinHowTo')}</h2>
        <p className="cx-copy" style={{ whiteSpace: 'pre-wrap' }}>
          {state?.wheel?.help_text || t('spinDefaultHelp')}
        </p>
        <button type="button" className="btn-spin" style={{ marginTop: 14, minWidth: 140 }} onClick={() => setShowHelp(false)}>
          {t('spinGotIt')}
        </button>
      </Modal>

      <ConfirmDialog
        open={confirmSpin}
        tone="customer"
        title={t('spinReadyTitle')}
        body={t('spinReadyBodyGuest')}
        confirmLabel={t('spinConfirmSpin')}
        cancelLabel={t('spinCancel')}
        busy={spinning}
        onCancel={() => setConfirmSpin(false)}
        onConfirm={spin}
      />

      <Modal
        open={showWin && !!displayResult}
        onClose={() => setShowWin(false)}
        className={`win-modal-panel ${isMajor ? 'major-win' : ''}`.trim()}
      >
        {displayResult && (
          <motion.div
            className="reward-detail reward-detail--win"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          >
            <WinSuccessMark />
            <span className="win-modal-badge">{isMajor ? t('spinMajorPrize') : t('spinCongrats')}</span>
            <h2 className="cx-title reward-detail-title">{displayResult.prize_label}</h2>
            {mediaUrl(displayResult.image_url || displayResult.image_path) ? (
              <img className="win-modal-art" src={mediaUrl(displayResult.image_url || displayResult.image_path)} alt="" />
            ) : (
              <div className="win-modal-fallback">
                {(displayResult.prize_label || '?').slice(0, 1)}
              </div>
            )}
            {displayResult.winning_message && (
              <p className="reward-detail-message">{displayResult.winning_message}</p>
            )}
            {displayResult.description && (
              <p className="reward-detail-product" style={{ textAlign: 'center' }}>
                {displayResult.description}
              </p>
            )}
            {displayResult.requires_claim !== false && (
              <div className="ref-box">
                <span className="ref-box-label">{t('spinShowStaffRef')}</span>
                <strong className="ref-box-code">{displayResult.reward_code}</strong>
                {displayResult.instructions && (
                  <span className="ref-box-help">{displayResult.instructions}</span>
                )}
              </div>
            )}
            <button type="button" className="btn-spin" style={{ marginTop: 14 }} onClick={() => setShowWin(false)}>
              {t('spinDone')}
            </button>
          </motion.div>
        )}
      </Modal>
    </main>
  )
}
