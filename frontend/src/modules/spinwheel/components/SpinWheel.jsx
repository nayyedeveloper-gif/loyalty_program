import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { mediaUrl } from '../lib/media'

const SPIN_MS = 5400
const IDLE_DEG_PER_MS = 0.012
const DEFAULT_COLORS = ['#7a1018', '#c9a227', '#4a070c', '#e0c36a', '#8f1c24', '#b8860b']

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360
}

const SpinWheel = forwardRef(function SpinWheel(
  { segments = [], idle = false, highlightIndex = null, celebrating = false, className = '', compact = false },
  ref,
) {
  const diskRef = useRef(null)
  const pointerRef = useRef(null)
  const rotationRef = useRef(0)
  const spinningRef = useRef(false)
  const idleRafRef = useRef(0)
  const tickRef = useRef(-1)
  const [ticking, setTicking] = useState(false)

  const gradient = useMemo(() => {
    if (!segments.length) return 'conic-gradient(#2a0a0a 0 100%)'
    const slice = 360 / segments.length
    const stops = segments.map((s, i) => {
      const color = s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]
      return `${color} ${i * slice}deg ${(i + 1) * slice}deg`
    })
    return `conic-gradient(from 0deg, ${stops.join(', ')})`
  }, [segments])

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
    if (idleRafRef.current) {
      cancelAnimationFrame(idleRafRef.current)
      idleRafRef.current = 0
    }
  }

  const bouncePointer = () => {
    if (!pointerRef.current) return
    pointerRef.current.classList.remove('pointer-tick')
    void pointerRef.current.offsetWidth
    pointerRef.current.classList.add('pointer-tick')
    setTicking(true)
    window.setTimeout(() => setTicking(false), 110)
  }

  useEffect(() => {
    applyRotation(rotationRef.current)
  }, [])

  useEffect(() => {
    stopIdle()
    if (!idle || spinningRef.current || !diskRef.current) return undefined

    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(32, now - last)
      last = now
      const next = rotationRef.current + dt * IDLE_DEG_PER_MS
      applyRotation(next)

      if (segments.length) {
        const slice = 360 / segments.length
        const edge = Math.floor(normalizeDeg(next) / slice)
        if (edge !== tickRef.current) {
          tickRef.current = edge
          bouncePointer()
        }
      }
      idleRafRef.current = requestAnimationFrame(tick)
    }
    idleRafRef.current = requestAnimationFrame(tick)
    return stopIdle
  }, [idle, segments.length])

  useImperativeHandle(ref, () => ({
    async spinToIndex(index) {
      if (!diskRef.current || !segments.length || spinningRef.current) return false
      spinningRef.current = true
      stopIdle()

      const slice = 360 / segments.length
      const centerAngle = index * slice + slice / 2
      const landing = normalizeDeg(360 - centerAngle)
      const current = rotationRef.current
      let delta = normalizeDeg(landing - normalizeDeg(current))
      if (delta < 70) delta += 360

      const turns = 6 + Math.floor(Math.random() * 2)
      const target = current + turns * 360 + delta
      const from = current
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const duration = reduced ? 850 : SPIN_MS

      applyRotation(from)

      const disk = diskRef.current
      await new Promise((resolve) => {
        const anim = disk.animate(
          [
            { transform: `rotate(${from}deg)` },
            { transform: `rotate(${from + (target - from) * 0.22}deg)`, offset: 0.18, easing: 'cubic-bezier(0.4, 0, 0.85, 0.35)' },
            { transform: `rotate(${target}deg)`, easing: 'cubic-bezier(0.08, 0.72, 0.08, 1)' },
          ],
          { duration, fill: 'forwards', easing: 'cubic-bezier(0.1, 0.7, 0.1, 1)' },
        )

        const tickTimer = window.setInterval(bouncePointer, reduced ? 140 : 68)
        anim.onfinish = () => {
          window.clearInterval(tickTimer)
          try {
            anim.commitStyles()
          } catch {
            // Older browsers may not support commitStyles.
          }
          applyRotation(target)
          anim.cancel()
          bouncePointer()
          resolve()
        }
        anim.oncancel = () => {
          window.clearInterval(tickTimer)
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
      <div ref={pointerRef} className={`wheel-pointer ${ticking ? 'pointer-tick' : ''}`}>
        <span className="pointer-jewel" />
      </div>
      <div ref={diskRef} className="wheel-disk" style={{ background: gradient }}>
        <div className="wheel-inner-ring" aria-hidden />
        {segments.map((s, i) => {
          const slice = 360 / segments.length
          const angle = i * slice + slice / 2
          const won = highlightIndex === i
          const src = mediaUrl(s.image_url || s.image_path) || undefined
          return (
            <div
              key={s.id ?? i}
              className={`wheel-seg ${won ? 'is-win' : ''} ${s.tier === 'major' ? 'is-major' : ''}`}
              style={{ transform: `rotate(${angle}deg)` }}
            >
              <div className="wheel-seg-content">
                {src ? (
                  <span className="wheel-seg-art">
                    <img
                      className="wheel-seg-img"
                      src={src}
                      alt={s.prize_label || s.display_label || 'Prize'}
                      draggable={false}
                    />
                  </span>
                ) : (
                  <span className="wheel-seg-fallback" aria-hidden>
                    {(s.display_label || s.prize_label || '?').slice(0, 1)}
                  </span>
                )}
                <span className="wheel-seg-label">{s.display_label || s.prize_label}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="wheel-hub" aria-hidden>
        <div className="hub-core"><span>SPIN</span></div>
      </div>
      {highlightIndex != null && <div className="wheel-win-halo" aria-hidden />}
    </div>
  )
})

export default SpinWheel
