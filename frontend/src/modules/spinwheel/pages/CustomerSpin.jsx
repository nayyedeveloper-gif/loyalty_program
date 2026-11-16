import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '../../../context/AuthContext'
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

function remainingLabel(deadline) {
  if (!deadline) return null
  const ms = new Date(deadline).getTime() - Date.now()
  if (ms <= 0) return 'Past deadline'
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  if (days > 0) return `${days}d ${hours}h left`
  const mins = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${mins}m left`
}

function rewardCardHint(r) {
  if (r.display_status === 'ready_to_collect') {
    const left = remainingLabel(r.claim_deadline_at)
    return left ? `Collect within ${left}` : 'Show reference to staff'
  }
  if (r.display_status === 'claimed') return 'Already collected'
  if (r.display_status === 'expired') return 'Collection window ended'
  if (r.display_status === 'no_collection_required') return 'No staff collection needed'
  return null
}

export default function CustomerSpin() {
  const { user } = useAuth()
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
      setError(getErrorMessage(err, 'Unable to load customer state'))
      return null
    } finally {
      setLoading(false)
    }
  }, [notifyPromoChanged])

  const claimPromo = async () => {
    if (!pendingPromo?.id || promoBusy) return
    setPromoBusy(true)
    setError('')
    try {
      const { data } = await api.post(`/spinwheel/promos/${pendingPromo.id}/claim`)
      setPromoNote(`Claimed ${data.granted || pendingPromo.spin_count} spin(s). Enjoy!`)
      setPendingPromo(null)
      notifyPromoChanged(data.has_pending)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to claim promo'))
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
      setError(getErrorMessage(err, 'Unable to dismiss promo'))
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
        setRecoverNote('Recovered your previous spin result.')
        setTab('wheel')
        await presentResult(data, { animate: false })
        localStorage.removeItem(pendingKey(user.id))
        await load()
      } catch {
        /* keep pending */
      }
    })()
    return () => { cancelled = true }
  }, [user?.id, load, presentResult])

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
      if (data.recovered) setRecoverNote('Showing the already-recorded result for this spin.')
      await presentResult(data, { animate: true })
      localStorage.removeItem(pendingKey(user.id))
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to spin'))
      try {
        const { data } = await api.get(`/spinwheel/spins/by-key/${encodeURIComponent(key)}`)
        await presentResult(data, { animate: true })
        localStorage.removeItem(pendingKey(user.id))
        setRecoverNote('Recovered spin after a connection issue.')
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
    () => Array.from({ length: 40 }).map((_, i) => ({
      left: `${(i * 9 + 4) % 100}%`,
      delay: `${(i % 12) * 0.05}s`,
      color: i % 3 === 0 ? '#e8d5a8' : i % 3 === 1 ? '#f3e6c8' : '#d4b896',
      w: 6 + (i % 4),
      h: 10 + (i % 5),
    })),
    [],
  )

  return (
    <main className="cx-shell">
      <header className="cx-header">
        <BrandMark
          title={state?.wheel?.brand_title || state?.wheel?.name}
          logoUrl={state?.wheel?.logo_url || state?.wheel?.logo_path}
          subtitle={`${user?.name || 'Member'}${user?.customer_code ? ` · ${user.customer_code}` : ''}`}
        />
        <div className="cx-nav">
          <span className="spin-chip">{state?.spins_remaining ?? '…'} spins</span>
          <button type="button" className={`cx-nav-btn ${tab === 'wheel' ? 'is-active' : ''}`} onClick={() => setTab('wheel')}>
            Spin Wheel
          </button>
          <button type="button" className={`cx-nav-btn ${tab === 'rewards' ? 'is-active' : ''}`} onClick={() => setTab('rewards')}>
            My Rewards
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
              Claim to receive <strong>{pendingPromo.spin_count}</strong> spin
              {pendingPromo.spin_count === 1 ? '' : 's'}
              {pendingPromo.valid_hours ? ` · valid for ${pendingPromo.valid_hours}h` : ''}.
              Closing skips this offer.
            </p>
            <div className="dialog-actions">
              <button type="button" className="cx-ghost" onClick={dismissPromo} disabled={promoBusy}>
                No thanks
              </button>
              <button type="button" className="btn-spin" onClick={claimPromo} disabled={promoBusy}>
                {promoBusy ? 'Working…' : 'Claim spins'}
              </button>
            </div>
          </>
        )}
      </Modal>
      {recoverNote && <div className="toast toast-ok">{recoverNote}</div>}

      {tab === 'wheel' && (
        <section className="cx-card wheel-panel spin-stage">
          <Title
            title={state?.wheel?.page_title || state?.wheel?.name || 'Spin Wheel'}
            onHelp={() => setShowHelp(true)}
          />

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
              <span>Available spins</span>
            </div>
            <div className="cx-stat">
              <strong>{loading ? '—' : (state?.rewards?.length ?? 0)}</strong>
              <span>Rewards won</span>
            </div>
          </div>

          {!!state?.expiry_groups?.length && (
            <div className="hint" style={{ marginTop: '0.65rem' }}>
              {state.expiry_groups.map((g) => (
                <div key={g.expires_on}>
                  {g.count} spin{g.count === 1 ? '' : 's'} expire {new Date(g.expires_at).toLocaleString()}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className={`btn-spin ${spinning ? 'is-loading' : ''}`}
            disabled={!canSpin}
            onClick={() => setConfirmSpin(true)}
          >
            {spinning ? 'Spinning…' : state?.spins_remaining ? 'Spin Now' : 'No Spins Available'}
          </button>
          {!loading && !state?.spins_remaining && (
            <p className="hint">Ask staff to grant spins in Admin.</p>
          )}
        </section>
      )}

      {tab === 'rewards' && (
        <section className="cx-card">
          <div className="rewards-toolbar">
            <div>
              <h2 className="cx-title" style={{ fontSize: '1.8rem', margin: 0 }}>My Rewards</h2>
              <p className="cx-copy" style={{ marginTop: 6 }}>Tap a prize for details and your collection reference.</p>
            </div>
            <div style={{ minWidth: 200 }}>
              <label className="cx-kicker" htmlFor="reward-filter">Filter</label>
              <select id="reward-filter" className="field-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All rewards</option>
                <option value="ready_to_collect">Ready to collect</option>
                <option value="claimed">Claimed</option>
                <option value="expired">Expired</option>
                <option value="no_collection_required">No collection required</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="rewards-grid">
              {[1, 2, 3].map((i) => <Skeleton key={i} height={200} radius={16} />)}
            </div>
          ) : rewards.length === 0 ? (
            <EmptyState
              title="No rewards here yet"
              body="Spin the wheel to win your first prize, or change the filter."
              action={<button type="button" className="btn-spin" style={{ marginTop: 12 }} onClick={() => setTab('wheel')}>Go spin</button>}
            />
          ) : (
            <div className="rewards-grid">
              {rewards.map((r) => {
                const hint = rewardCardHint(r)
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
        <p className="cx-kicker">Help</p>
        <h2 className="cx-title" style={{ fontSize: '1.7rem' }}>How to spin</h2>
        <p className="cx-copy" style={{ whiteSpace: 'pre-wrap' }}>
          {state?.wheel?.help_text
            || '1) Confirm your spin.\n2) The wheel stops on the prize selected by the server.\n3) Show your reward reference to staff for collection.'}
        </p>
        <button type="button" className="btn-spin" style={{ marginTop: 14, minWidth: 140 }} onClick={() => setShowHelp(false)}>
          Got it
        </button>
      </Modal>

      <ConfirmDialog
        open={confirmSpin}
        tone="customer"
        title="Ready to Spin?"
        body="You have an available spin. Once you confirm, your spin will be used."
        confirmLabel="Confirm & Spin"
        cancelLabel="Cancel"
        busy={spinning}
        onCancel={() => setConfirmSpin(false)}
        onConfirm={spin}
      />

      <Modal open={showWin && !!result} onClose={() => setShowWin(false)} className={isMajor ? 'major-win' : ''}>
        {result && (
          <div className="reward-detail reward-detail--win">
            <p className="cx-kicker">{isMajor ? 'Major prize' : 'You won'}</p>
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
              <span className="ref-box-label">Show staff this reference</span>
              <strong className="ref-box-code">{result.reward_code}</strong>
            </div>
            <div className="reward-detail-actions">
              <button
                type="button"
                className="btn-spin"
                style={{ minWidth: 160 }}
                onClick={() => { setShowWin(false); setTab('rewards'); setSelectedReward(result) }}
              >
                Prize details
              </button>
              <button type="button" className="cx-ghost" onClick={() => setShowWin(false)}>Keep spinning</button>
            </div>
          </div>
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
                Collect by {new Date(selectedReward.claim_deadline_at).toLocaleDateString()}
                {remainingLabel(selectedReward.claim_deadline_at)
                  ? ` · ${remainingLabel(selectedReward.claim_deadline_at)}`
                  : ''}
              </p>
            )}

            {selectedReward.requires_claim && selectedReward.display_status === 'ready_to_collect' && (
              <div className="ref-box">
                <span className="ref-box-label">Collection reference</span>
                <strong className="ref-box-code">{selectedReward.reward_code}</strong>
                <span className="ref-box-help">Show this code to staff to collect your prize.</span>
              </div>
            )}

            {selectedReward.requires_claim && selectedReward.display_status !== 'ready_to_collect' && (
              <p className="reward-detail-ref-quiet">
                Reference <strong>{selectedReward.reward_code}</strong>
              </p>
            )}

            {selectedReward.instructions && selectedReward.display_status === 'ready_to_collect' && (
              <div className="reward-detail-section">
                <p className="reward-detail-section-label">How to collect</p>
                <p className="reward-detail-section-body">{selectedReward.instructions}</p>
              </div>
            )}

            <p className="reward-detail-meta">
              Won {selectedReward.created_at ? new Date(selectedReward.created_at).toLocaleDateString() : '—'}
            </p>

            <button type="button" className="cx-ghost" style={{ marginTop: 14 }} onClick={() => setSelectedReward(null)}>
              Close
            </button>
          </div>
        )}
      </Modal>
    </main>
  )
}
