import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '../../../context/AuthContext'
import { useLanguage } from '../../../context/LanguageContext'
import api, { getErrorMessage } from '../../../lib/api'
import { mediaUrl } from '../lib/media'
import { useLiveWheelSync } from '../lib/useLiveWheelSync'
import SpinWheel from '../components/SpinWheel'
import BrandMark from '../components/BrandMark'
import Title from '../components/Title'
import { ConfirmDialog, EmptyState, Modal, Skeleton, StatusBadge } from '../components/ui'
import '../styles/fonts.css'
import '../styles/spinwheel.css'

function pendingKey(userId) {
  return `pending_spin_${userId}`
}

function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `spin_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function remainingLabel(deadline, t) {
  if (!deadline) return null
  const ms = new Date(deadline).getTime() - Date.now()
  if (ms <= 0) return t('spinPastDeadline')
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  if (days > 0) return t('spinTimeLeftDays', { days, hours })
  const mins = Math.floor((ms % 3600000) / 60000)
  return t('spinTimeLeftHours', { hours, mins })
}

function rewardCardHint(r, t) {
  if (r.display_status === 'ready_to_collect') {
    const left = remainingLabel(r.claim_deadline_at, t)
    return left ? t('spinHintCollectWithin', { left }) : t('spinHintShowStaff')
  }
  if (r.display_status === 'claimed') return t('spinHintClaimed')
  if (r.display_status === 'expired') return t('spinHintExpired')
  if (r.display_status === 'no_collection_required') return t('spinHintNoCollect')
  return null
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

function spinCountLabel(t, count) {
  const n = Number(count) || 0
  return n === 1 ? t('spinChipOne', { count: n }) : t('spinChipCount', { count: n })
}

function remainingSpinsLabel(t, count) {
  const n = Number(count) || 0
  return n === 1 ? t('spinRemainingOne', { count: n }) : t('spinRemaining', { count: n })
}

export default function CustomerSpin() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [tab, setTab] = useState('wheel')
  const [filter, setFilter] = useState('all')
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null)
  const [showWin, setShowWin] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [selectedReward, setSelectedReward] = useState(null)
  const [recoverNote, setRecoverNote] = useState('')
  const [confirmSpin, setConfirmSpin] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [pendingPromo, setPendingPromo] = useState(null)
  const [promoBusy, setPromoBusy] = useState(false)
  const [promoNote, setPromoNote] = useState('')
  const wheelRef = useRef(null)
  const spinLock = useRef(false)

  const notifyPromoChanged = useCallback((hasPending) => {
    window.dispatchEvent(new CustomEvent('spinwheel:promo-changed', {
      detail: { hasPending: !!hasPending },
    }))
  }, [])

  const load = useCallback(async () => {
    try {
      const [{ data }, rewardsResponse] = await Promise.all([
        api.get('/spinwheel/state'),
        api.get('/spinwheel/rewards'),
      ])
      const next = {
        ...data,
        rewards: rewardsResponse.data || data?.rewards || [],
      }
      setState(next)
      setPendingPromo(next.pending_promo || null)
      notifyPromoChanged(!!next.has_pending_promo || !!next.pending_promo)
      setError('')
      return next
    } catch (err) {
      setError(getErrorMessage(err, t('spinUnableLoad')))
      return null
    } finally {
      setLoading(false)
    }
  }, [notifyPromoChanged, t])

  const claimPromo = async () => {
    if (!pendingPromo?.id || promoBusy) return
    setPromoBusy(true)
    setError('')
    try {
      const { data } = await api.post(`/spinwheel/promos/${pendingPromo.id}/claim`)
      setPromoNote(t('spinClaimedSpins', { count: data.granted || pendingPromo.spin_count }))
      setPendingPromo(null)
      notifyPromoChanged(data.has_pending)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('spinUnableClaimPromo')))
    } finally {
      setPromoBusy(false)
    }
  }

  const dismissPromo = async () => {
    if (!pendingPromo?.id || promoBusy) return
    setPromoBusy(true)
    setError('')
    try {
      const { data } = await api.post(`/spinwheel/promos/${pendingPromo.id}/dismiss`)
      setPendingPromo(null)
      notifyPromoChanged(data.has_pending)
    } catch (err) {
      setError(getErrorMessage(err, t('spinUnableDismissPromo')))
    } finally {
      setPromoBusy(false)
    }
  }

  const presentResult = useCallback(async (data, { animate } = { animate: true }) => {
    const index = Number(data.segment_index)
    if (animate && Number.isInteger(index) && index >= 0) {
      await wheelRef.current?.spinToIndex(index)
    }
    setResult(data.result)
    setHighlightIndex(Number.isInteger(index) ? index : null)
    setShowConfetti(true)
    setShowWin(true)
    setState((s) => (s ? { ...s, spins_remaining: data.spins_remaining } : s))
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await load()
      if (cancelled || !user?.id) return
      const key = localStorage.getItem(pendingKey(user.id))
      if (!key) return
      try {
        const { data } = await api.get(`/spinwheel/spins/by-key/${encodeURIComponent(key)}`)
        if (cancelled) return
        setRecoverNote(t('spinRecoveredPrev'))
        setTab('wheel')
        await presentResult(data, { animate: false })
        localStorage.removeItem(pendingKey(user.id))
        await load()
      } catch {
        /* keep pending */
      }
    })()
    return () => { cancelled = true }
  }, [user?.id, load, presentResult, t])

  useEffect(() => {
    if (!showConfetti) return undefined
    const t = setTimeout(() => setShowConfetti(false), 2000)
    return () => clearTimeout(t)
  }, [showConfetti])

  const applyLiveWheel = useCallback((wheel) => {
    setState((prev) => (prev ? { ...prev, wheel } : prev))
  }, [])

  useLiveWheelSync({
    enabled: !spinning && !showWin,
    onWheelChange: applyLiveWheel,
  })

  const rewards = useMemo(() => {
    const list = state?.rewards || []
    if (filter === 'all') return list
    return list.filter((r) => r.display_status === filter)
  }, [state, filter])

  const spin = async () => {
    if (spinLock.current || spinning || !state?.spins_remaining || !user?.id) return
    spinLock.current = true
    setConfirmSpin(false)
    setSpinning(true)
    setResult(null)
    setShowWin(false)
    setHighlightIndex(null)
    setShowConfetti(false)
    setRecoverNote('')
    setError('')

    const key = localStorage.getItem(pendingKey(user.id)) || newIdempotencyKey()
    localStorage.setItem(pendingKey(user.id), key)

    try {
      const { data } = await api.post('/spinwheel/spin', { idempotency_key: key })
      if (data.recovered) setRecoverNote(t('spinRecoveredRecorded'))
      await presentResult(data, { animate: true })
      localStorage.removeItem(pendingKey(user.id))
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('spinUnableSpin')))
      try {
        const { data } = await api.get(`/spinwheel/spins/by-key/${encodeURIComponent(key)}`)
        await presentResult(data, { animate: true })
        localStorage.removeItem(pendingKey(user.id))
        setRecoverNote(t('spinRecoveredConn'))
      } catch {
        /* still pending */
      }
      await load()
    } finally {
      setSpinning(false)
      spinLock.current = false
    }
  }

  const segments = state?.wheel?.segments || []
  const canSpin = !loading && !!state?.spins_remaining && !spinning
  const isMajor = result?.tier === 'major'

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
  const heroCopy = state?.wheel?.subtitle || t('spinDefaultCopy')
  const spinsLeft = state?.spins_remaining

  return (
    <main className="cx-shell">
      <header className="cx-header">
        <BrandMark
          title={state?.wheel?.brand_title || state?.wheel?.name}
          logoUrl={state?.wheel?.logo_url || state?.wheel?.logo_path}
          subtitle={`${user?.name || t('spinMember')}${user?.customer_code ? ` · ${user.customer_code}` : ''}`}
        />
        <div className="cx-nav">
          <span className="spin-chip">
            {spinsLeft == null ? '…' : spinCountLabel(t, spinsLeft)}
          </span>
          <button type="button" className={`cx-nav-btn ${tab === 'wheel' ? 'is-active' : ''}`} onClick={() => setTab('wheel')}>
            {t('spinTabWheel')}
          </button>
          <button type="button" className={`cx-nav-btn ${tab === 'rewards' ? 'is-active' : ''}`} onClick={() => setTab('rewards')}>
            {t('spinTabRewards')}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {error && <motion.div className="toast toast-err" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div>}
        {promoNote && !error && (
          <motion.div className="toast toast-ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{promoNote}</motion.div>
        )}
      </AnimatePresence>

      <Modal
        open={!!pendingPromo && !loading}
        onClose={promoBusy ? undefined : dismissPromo}
        tone="customer"
        className="promo-offer-modal"
      >
        {pendingPromo && (
          <>
            <h3>{pendingPromo.title}</h3>
            <p>{pendingPromo.message}</p>
            <p className="promo-offer-meta">
              {t('spinPromoMeta', {
                count: pendingPromo.spin_count,
                hours: pendingPromo.valid_hours
                  ? t('spinPromoHours', { hours: pendingPromo.valid_hours })
                  : '',
              })}
            </p>
            <div className="dialog-actions">
              <button type="button" className="cx-ghost" onClick={dismissPromo} disabled={promoBusy}>
                {t('spinNoThanks')}
              </button>
              <button type="button" className="btn-spin" onClick={claimPromo} disabled={promoBusy}>
                {promoBusy ? t('spinWorking') : t('spinClaimSpins')}
              </button>
            </div>
          </>
        )}
      </Modal>
      {recoverNote && <div className="toast toast-ok">{recoverNote}</div>}

      {tab === 'wheel' && (
        <section className="cx-card wheel-panel spin-stage">
          <Title title={heroTitle} onHelp={() => setShowHelp(true)} />
          <p className="spin-hero-copy">{heroCopy}</p>

          {showConfetti && (
            <>
              <div className="burst" aria-hidden />
              <div className="confetti" aria-hidden>
                {confettiPieces.map((p, i) => (
                  <i key={i} style={{ left: p.left, animationDelay: p.delay, background: p.color, width: p.w, height: p.h }} />
                ))}
              </div>
            </>
          )}

          {loading ? (
            <div style={{ padding: '2rem' }}>
              <Skeleton height={280} radius={999} width="min(360px, 80%)" />
            </div>
          ) : (
            <SpinWheel
              ref={wheelRef}
              segments={segments}
              idle={!spinning && !result}
              highlightIndex={highlightIndex}
              celebrating={!!result && showWin}
            />
          )}

          <div className="cx-stat-row spin-stats">
            <div className="cx-stat">
              <strong>{loading ? '—' : (state?.spins_remaining ?? 0)}</strong>
              <span>{t('spinAvailable')}</span>
            </div>
            <div className="cx-stat">
              <strong>{loading ? '—' : (state?.rewards?.length ?? 0)}</strong>
              <span>{t('spinRewardsWon')}</span>
            </div>
          </div>

          {!!state?.expiry_groups?.length && (
            <div className="hint" style={{ marginTop: '0.65rem' }}>
              {state.expiry_groups.map((g) => (
                <div key={g.expires_on}>
                  {t(g.count === 1 ? 'spinExpiresLineOne' : 'spinExpiresLine', {
                    count: g.count,
                    when: new Date(g.expires_at).toLocaleString(),
                  })}
                </div>
              ))}
            </div>
          )}

          <div className="spin-cta-wrap">
            <motion.button
              type="button"
              className={`btn-spin ${spinning ? 'is-loading' : ''}`}
              disabled={!canSpin}
              onClick={() => setConfirmSpin(true)}
              whileHover={canSpin ? { y: -2 } : undefined}
              whileTap={canSpin ? { scale: 0.98 } : undefined}
            >
              {spinning ? t('spinSpinning') : state?.spins_remaining ? t('spinNow') : t('spinNoSpins')}
            </motion.button>
            {!loading && (
              <span className="spins-remaining-pill" aria-live="polite">
                {remainingSpinsLabel(t, state?.spins_remaining ?? 0)}
              </span>
            )}
            {!loading && !state?.spins_remaining && (
              <p className="hint">{t('spinAskStaff')}</p>
            )}
            <p className="hint">{t('spinConfirmHint')}</p>
          </div>
        </section>
      )}

      {tab === 'rewards' && (
        <section className="cx-card">
          <div className="rewards-toolbar">
            <div>
              <h2 className="cx-title" style={{ fontSize: '1.8rem', margin: 0 }}>{t('spinRewardsTitle')}</h2>
              <p className="cx-copy" style={{ marginTop: 6 }}>{t('spinRewardsCopy')}</p>
            </div>
            <div style={{ minWidth: 200 }}>
              <label className="cx-kicker" htmlFor="reward-filter">{t('spinFilter')}</label>
              <select id="reward-filter" className="field-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">{t('spinFilterAll')}</option>
                <option value="ready_to_collect">{t('spinFilterReady')}</option>
                <option value="claimed">{t('spinFilterClaimed')}</option>
                <option value="expired">{t('spinFilterExpired')}</option>
                <option value="no_collection_required">{t('spinFilterNone')}</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="rewards-grid">
              {[1, 2, 3].map((i) => <Skeleton key={i} height={200} radius={16} />)}
            </div>
          ) : rewards.length === 0 ? (
            <EmptyState
              title={t('spinNoRewardsTitle')}
              body={t('spinNoRewardsBody')}
              action={<button type="button" className="btn-spin" style={{ marginTop: 12 }} onClick={() => setTab('wheel')}>{t('spinGoSpin')}</button>}
            />
          ) : (
            <div className="rewards-grid">
              {rewards.map((r) => {
                const hint = rewardCardHint(r, t)
                return (
                  <motion.button
                    key={r.id}
                    type="button"
                    className="reward-card"
                    whileHover={{ y: -2 }}
                    onClick={() => setSelectedReward(r)}
                  >
                    {mediaUrl(r.image_url || r.image_path) ? (
                      <img className="media" src={mediaUrl(r.image_url || r.image_path)} alt="" />
                    ) : (
                      <div className="media-fallback">{(r.prize_label || '?').slice(0, 1)}</div>
                    )}
                    <div className="reward-card-top">
                      <strong className="reward-card-title">{r.prize_label}</strong>
                      <StatusBadge status={r.display_status} label={r.status_label} />
                    </div>
                    {hint && <p className="reward-card-hint">{hint}</p>}
                  </motion.button>
                )
              })}
            </div>
          )}
        </section>
      )}

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
        body={t('spinReadyBody')}
        confirmLabel={t('spinConfirmSpin')}
        cancelLabel={t('spinCancel')}
        busy={spinning}
        onCancel={() => setConfirmSpin(false)}
        onConfirm={spin}
      />

      <Modal
        open={showWin && !!result}
        onClose={() => setShowWin(false)}
        className={`win-modal-panel ${isMajor ? 'major-win' : ''}`.trim()}
      >
        {result && (
          <motion.div
            className="reward-detail reward-detail--win"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          >
            <WinSuccessMark />
            <span className="win-modal-badge">{isMajor ? t('spinMajorPrize') : t('spinCongrats')}</span>
            <h2 className="cx-title reward-detail-title">{result.prize_label}</h2>
            {mediaUrl(result.image_url || result.image_path) ? (
              <img className="win-modal-art" src={mediaUrl(result.image_url || result.image_path)} alt="" />
            ) : (
              <div className="win-modal-fallback">{(result.prize_label || '?').slice(0, 1)}</div>
            )}
            {result.winning_message && (
              <p className="reward-detail-message">{result.winning_message}</p>
            )}
            <div className="ref-box">
              <span className="ref-box-label">{t('spinShowStaffRef')}</span>
              <strong className="ref-box-code">{result.reward_code}</strong>
            </div>
            <div className="reward-detail-actions">
              <button
                type="button"
                className="btn-spin"
                style={{ minWidth: 160 }}
                onClick={() => { setShowWin(false); setTab('rewards'); setSelectedReward(result) }}
              >
                {t('spinPrizeDetails')}
              </button>
              <button type="button" className="cx-ghost" onClick={() => setShowWin(false)}>{t('spinKeepSpinning')}</button>
            </div>
          </motion.div>
        )}
      </Modal>

      <Modal open={!!selectedReward} onClose={() => setSelectedReward(null)}>
        {selectedReward && (
          <div className="reward-detail">
            {mediaUrl(selectedReward.image_url || selectedReward.image_path) ? (
              <img className="reward-detail-art" src={mediaUrl(selectedReward.image_url || selectedReward.image_path)} alt="" />
            ) : (
              <div className="win-modal-fallback">{(selectedReward.prize_label || '?').slice(0, 1)}</div>
            )}
            <div className="reward-detail-head">
              <h2 className="cx-title reward-detail-title">{selectedReward.prize_label}</h2>
              <StatusBadge status={selectedReward.display_status} label={selectedReward.status_label} />
            </div>

            {selectedReward.description && (
              <p className="reward-detail-product">{selectedReward.description}</p>
            )}

            {selectedReward.display_status === 'ready_to_collect' && selectedReward.claim_deadline_at && (
              <p className="reward-detail-deadline">
                {t('spinCollectBy', { date: new Date(selectedReward.claim_deadline_at).toLocaleDateString() })}
                {remainingLabel(selectedReward.claim_deadline_at, t)
                  ? ` · ${remainingLabel(selectedReward.claim_deadline_at, t)}`
                  : ''}
              </p>
            )}

            {selectedReward.requires_claim && selectedReward.display_status === 'ready_to_collect' && (
              <div className="ref-box">
                <span className="ref-box-label">{t('spinCollectionRef')}</span>
                <strong className="ref-box-code">{selectedReward.reward_code}</strong>
                <span className="ref-box-help">{t('spinShowCodeStaff')}</span>
              </div>
            )}

            {selectedReward.requires_claim && selectedReward.display_status !== 'ready_to_collect' && (
              <p className="reward-detail-ref-quiet">
                {t('spinReference')} <strong>{selectedReward.reward_code}</strong>
              </p>
            )}

            {selectedReward.instructions && selectedReward.display_status === 'ready_to_collect' && (
              <div className="reward-detail-section">
                <p className="reward-detail-section-label">{t('spinHowToCollect')}</p>
                <p className="reward-detail-section-body">{selectedReward.instructions}</p>
              </div>
            )}

            <p className="reward-detail-meta">
              {t('spinWonOn', {
                date: selectedReward.created_at
                  ? new Date(selectedReward.created_at).toLocaleDateString()
                  : '—',
              })}
            </p>

            <button type="button" className="cx-ghost" style={{ marginTop: 14 }} onClick={() => setSelectedReward(null)}>
              {t('spinClose')}
            </button>
          </div>
        )}
      </Modal>
    </main>
  )
}
