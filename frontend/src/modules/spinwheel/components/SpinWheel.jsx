import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { mediaUrl } from '../lib/media'

const SPIN_MS = 4500
/** Slow idle drift: one full turn every 45s (compositor-friendly WAAPI). */
const IDLE_TURN_MS = 45000

/** Matches main membership primary blues / soft surfaces. */
const PREMIUM_PALETTE = [
  '#2563eb',
  '#ffffff',
  '#3b82f6',
  '#dbeafe',
  '#1d4ed8',
  '#eff6ff',
  '#60a5fa',
  '#f3f7ff',
  '#2563eb',
  '#f8fbff',
]

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360
}

function isLightColor(hex) {
  const h = String(hex || '').replace('#', '')
  if (h.length !== 6) return false
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 180
}

function PremiumPointer() {
  const uid = useId().replace(/:/g, '')
  const body = `ptr-body-${uid}`
  const edge = `ptr-edge-${uid}`
  const base = `ptr-base-${uid}`

  return (
    <svg className="wheel-pointer-svg" viewBox="0 0 64 88" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={body} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="45%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id={edge} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.45" />
        </linearGradient>
        <radialGradient id={base} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#eff6ff" />
          <stop offset="55%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="18" r="14" fill={`url(#${base})`} stroke="#93c5fd" strokeWidth="2.5" />
      <circle cx="32" cy="18" r="7" fill="#ffffff" stroke="#dbeafe" strokeWidth="1.5" />
      <circle cx="32" cy="16.5" r="2.2" fill="#bfdbfe" opacity="0.9" />
      <path
        d="M18 28 L32 78 L46 28 Z"
        fill={`url(#${body})`}
        stroke="#2563eb"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M24 30 L32 68 L40 30 Z" fill={`url(#${edge})`} opacity="0.55" />
      <path d="M27 34 L32 54 L37 34 Z" fill="#ffffff" opacity="0.35" />
    </svg>
  )
}

const SpinWheel = forwardRef(function SpinWheel(
  { segments = [], idle = false, highlightIndex = null, celebrating = false, className = '', compact = false },
  ref,
) {
  const diskRef = useRef(null)
  const pointerRef = useRef(null)
  const tipRef = useRef(null)
  const tipCursorRef = useRef({ x: 0, y: 0 })
  const rotationRef = useRef(0)
  const spinningRef = useRef(false)
  const idleAnimRef = useRef(null)
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const paletteColors = useMemo(
    () => segments.map((_, i) => PREMIUM_PALETTE[i % PREMIUM_PALETTE.length]),
    [segments],
  )

  const gradient = useMemo(() => {
    if (!segments.length) return 'conic-gradient(#1e3a8a 0 100%)'
    const slice = 360 / segments.length
    const stops = paletteColors.map((color, i) => `${color} ${i * slice}deg ${(i + 1) * slice}deg`)
    return `conic-gradient(from 0deg, ${stops.join(', ')})`
  }, [segments.length, paletteColors])

  const artSize = useMemo(() => {
    const n = segments.length || 1
    if (compact) return n <= 6 ? 48 : 38
    if (n <= 4) return 92
    if (n <= 6) return 78
    if (n <= 8) return 66
    if (n <= 10) return 56
    return 48
  }, [segments.length, compact])

  const applyRotation = (deg) => {
    rotationRef.current = deg
    if (diskRef.current) diskRef.current.style.transform = `rotate(${deg}deg)`
  }

  const stopIdle = () => {
    const anim = idleAnimRef.current
    if (!anim) return
    const from = rotationRef.current
    const elapsedTurns = (Number(anim.currentTime) || 0) / IDLE_TURN_MS
    anim.cancel()
    idleAnimRef.current = null
    applyRotation(from + elapsedTurns * 360)
  }

  useEffect(() => {
    applyRotation(rotationRef.current)
  }, [])

  useEffect(() => {
    stopIdle()
    if (!idle || spinningRef.current || !diskRef.current) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const disk = diskRef.current
    const from = rotationRef.current
    idleAnimRef.current = disk.animate(
      [
        { transform: `rotate(${from}deg)` },
        { transform: `rotate(${from + 360}deg)` },
      ],
      { duration: IDLE_TURN_MS, iterations: Infinity, easing: 'linear' },
    )

    return stopIdle
  }, [idle])

  const clearHover = () => setHoveredIndex(null)

  /** Place tooltip to the left of the pointer / focus target. */
  const placeTipNear = (clientX, clientY) => {
    const el = tipRef.current
    if (!el) return
    tipCursorRef.current = { x: clientX, y: clientY }
    const tipW = el.offsetWidth || 280
    const tipH = el.offsetHeight || 110
    const gap = 16
    let x = clientX - tipW - gap
    let y = clientY - tipH / 2
    x = Math.max(8, Math.min(x, window.innerWidth - tipW - 8))
    y = Math.max(8, Math.min(y, window.innerHeight - tipH - 8))
    el.style.left = `${x}px`
    el.style.top = `${y}px`
  }

  const showPrize = (index, event) => {
    if (spinningRef.current || compact) return
    if (event?.clientX != null) {
      tipCursorRef.current = { x: event.clientX, y: event.clientY }
    } else if (event?.currentTarget?.getBoundingClientRect) {
      const r = event.currentTarget.getBoundingClientRect()
      tipCursorRef.current = { x: r.left, y: r.top + r.height / 2 }
    }
    setHoveredIndex(index)
  }

  const trackTip = (event) => {
    if (hoveredIndex == null || spinningRef.current) return
    placeTipNear(event.clientX, event.clientY)
  }

  useEffect(() => {
    if (hoveredIndex == null) return undefined
    const { x, y } = tipCursorRef.current
    const id = requestAnimationFrame(() => placeTipNear(x, y))
    return () => cancelAnimationFrame(id)
  }, [hoveredIndex])

  const hovered = hoveredIndex != null ? segments[hoveredIndex] : null
  const hoveredSrc = hovered
    ? mediaUrl(hovered.image_url || hovered.image_path) || undefined
    : undefined
  const hoveredTitle = hovered?.prize_label || hovered?.display_label || 'Prize'
  const hoveredDetail = hovered?.description
    || hovered?.winning_message
    || hovered?.instructions
    || null

  useImperativeHandle(ref, () => ({
    async spinToIndex(index) {
      if (!diskRef.current || !segments.length || spinningRef.current) return false
      spinningRef.current = true
      clearHover()
      stopIdle()

      const slice = 360 / segments.length
      const centerAngle = index * slice + slice / 2
      const landing = normalizeDeg(360 - centerAngle)
      const current = rotationRef.current
      let delta = normalizeDeg(landing - normalizeDeg(current))
      if (delta < 90) delta += 360

      const turns = 5
      const target = current + turns * 360 + delta
      const from = current
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const duration = reduced ? 800 : SPIN_MS

      const disk = diskRef.current
      const pointer = pointerRef.current
      pointer?.classList.remove('is-settle')
      if (!reduced) pointer?.classList.add('is-spinning')

      await new Promise((resolve) => {
        const anim = disk.animate(
          [
            { transform: `rotate(${from}deg)` },
            { transform: `rotate(${target}deg)` },
          ],
          {
            duration,
            easing: 'cubic-bezier(0.15, 0.7, 0.1, 1)',
            fill: 'forwards',
          },
        )

        const finish = () => {
          pointer?.classList.remove('is-spinning')
          try {
            anim.commitStyles()
          } catch {
            /* older browsers */
          }
          applyRotation(target)
          anim.cancel()
          if (!reduced) {
            pointer?.classList.add('is-settle')
            window.setTimeout(() => pointer?.classList.remove('is-settle'), 400)
          }
          resolve()
        }

        anim.onfinish = finish
        anim.oncancel = () => {
          pointer?.classList.remove('is-spinning')
          applyRotation(target)
          resolve()
        }
      })

      spinningRef.current = false
      return true
    },
  }))

  return (
    <div
      className={`wheel-stage ${compact ? 'is-compact' : ''} ${celebrating ? 'is-celebrating' : ''} ${className}`.trim()}
      style={{ '--wheel-art': `${artSize}px` }}
    >
      <div className="wheel-aura" aria-hidden />
      <div className="wheel-outer-ring" aria-hidden />
      <div className="wheel-bezel" aria-hidden />
      <div ref={pointerRef} className="wheel-pointer" aria-hidden>
        <PremiumPointer />
      </div>
      <div ref={diskRef} className="wheel-disk" style={{ background: gradient }}>
        <div
          className="wheel-divider-ring"
          aria-hidden
          style={
            segments.length
              ? { '--seg-slice': `${360 / segments.length}deg` }
              : undefined
          }
        />
        <div className="wheel-inner-ring" aria-hidden />
        {segments.map((s, i) => {
          const slice = 360 / segments.length
          const angle = i * slice + slice / 2
          const won = highlightIndex === i
          const src = mediaUrl(s.image_url || s.image_path) || undefined
          const fill = paletteColors[i]
          const light = isLightColor(fill)
          const title = s.display_label || s.prize_label || 'Prize'
          return (
            <div
              key={s.id ?? i}
              className={`wheel-seg ${won ? 'is-win' : ''} ${s.tier === 'major' ? 'is-major' : ''} ${light ? 'is-light' : ''} ${hoveredIndex === i ? 'is-hovered' : ''}`}
              style={{ transform: `rotate(${angle}deg)` }}
            >
              <button
                type="button"
                className="wheel-seg-content"
                aria-label={`Prize details: ${title}`}
                onMouseEnter={(e) => showPrize(i, e)}
                onMouseMove={trackTip}
                onMouseLeave={clearHover}
                onFocus={(e) => showPrize(i, e)}
                onBlur={clearHover}
                onClick={(e) => {
                  e.preventDefault()
                  if (hoveredIndex === i) clearHover()
                  else showPrize(i, e)
                }}
              >
                {src ? (
                  <span className="wheel-seg-art">
                    <img
                      className="wheel-seg-img"
                      src={src}
                      alt=""
                      draggable={false}
                    />
                  </span>
                ) : (
                  <span className="wheel-seg-fallback" aria-hidden>
                    {title.slice(0, 1)}
                  </span>
                )}
                <span className="wheel-seg-label">{title}</span>
              </button>
            </div>
          )
        })}
      </div>
      <div className="wheel-hub" aria-hidden>
        <div className="hub-core">
          <span>SPIN</span>
        </div>
      </div>
      {highlightIndex != null && <div className="wheel-win-halo" aria-hidden />}

      {hovered && (
        <div ref={tipRef} className="wheel-prize-tip" role="tooltip">
          <div className="wheel-prize-tip-media">
            {hoveredSrc ? (
              <img src={hoveredSrc} alt="" draggable={false} />
            ) : (
              <span className="wheel-prize-tip-fallback" aria-hidden>
                {hoveredTitle.slice(0, 1)}
              </span>
            )}
          </div>
          <div className="wheel-prize-tip-body">
            {hovered.tier === 'major' && <span className="wheel-prize-tip-badge">Major prize</span>}
            <strong className="wheel-prize-tip-title">{hoveredTitle}</strong>
            {hoveredDetail ? (
              <p className="wheel-prize-tip-text">{hoveredDetail}</p>
            ) : (
              <p className="wheel-prize-tip-text wheel-prize-tip-text--muted">
                Spin to try for this reward.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

export default SpinWheel
