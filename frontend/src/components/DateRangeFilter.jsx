import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarDays, faChevronLeft, faChevronRight, faXmark } from '../lib/icons'

function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseIso(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1)
}

function formatLabel(dateFrom, dateTo, t, lang) {
  if (!dateFrom && !dateTo) return t('dateFilter')
  const locale = lang === 'my' ? 'my-MM' : undefined
  const fmt = (iso) => {
    const d = parseIso(iso)
    if (!d) return iso
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
  }
  if (dateFrom && dateTo && dateFrom === dateTo) return fmt(dateFrom)
  if (dateFrom && dateTo) return `${fmt(dateFrom)} – ${fmt(dateTo)}`
  if (dateFrom) return `${t('dateFrom')}: ${fmt(dateFrom)}`
  return `${t('dateTo')}: ${fmt(dateTo)}`
}

function buildMonthCells(viewMonth) {
  const first = startOfMonth(viewMonth)
  const startPad = first.getDay()
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startPad; i += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(first.getFullYear(), first.getMonth(), day))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function DateRangeFilter({ dateFrom = '', dateTo = '', onChange, t, lang = 'en' }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState(dateFrom && dateTo && dateFrom !== dateTo ? 'range' : 'single')
  const [draftFrom, setDraftFrom] = useState(dateFrom || '')
  const [draftTo, setDraftTo] = useState(dateTo || '')
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseIso(dateFrom) || new Date()))
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) {
      setDraftFrom(dateFrom || '')
      setDraftTo(dateTo || '')
      setMode(dateFrom && dateTo && dateFrom !== dateTo ? 'range' : 'single')
      setViewMonth(startOfMonth(parseIso(dateFrom) || parseIso(dateTo) || new Date()))
    }
  }, [dateFrom, dateTo, open])

  useEffect(() => {
    if (!open) return undefined
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth])
  const active = !!(dateFrom || dateTo)
  const monthLabel = viewMonth.toLocaleDateString(lang === 'my' ? 'my-MM' : undefined, {
    month: 'long',
    year: 'numeric',
  })

  function apply(nextFrom, nextTo) {
    let from = nextFrom || ''
    let to = nextTo || ''
    if (from && to && from > to) [from, to] = [to, from]
    onChange?.({ dateFrom: from, dateTo: to })
    setOpen(false)
  }

  function clear() {
    setDraftFrom('')
    setDraftTo('')
    onChange?.({ dateFrom: '', dateTo: '' })
    setOpen(false)
  }

  function pickDay(day) {
    const iso = toIsoDate(day)
    if (mode === 'single') {
      setDraftFrom(iso)
      setDraftTo(iso)
      apply(iso, iso)
      return
    }
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(iso)
      setDraftTo('')
      return
    }
    setDraftTo(iso)
    apply(draftFrom, iso)
  }

  function isSelected(day) {
    const iso = toIsoDate(day)
    if (!draftFrom && !draftTo) return false
    if (draftFrom && draftTo) return iso >= draftFrom && iso <= draftTo
    return iso === draftFrom || iso === draftTo
  }

  function isEndpoint(day) {
    const iso = toIsoDate(day)
    return iso === draftFrom || iso === draftTo
  }

  function preset(kind) {
    const today = new Date()
    const isoToday = toIsoDate(today)
    if (kind === 'today') {
      apply(isoToday, isoToday)
      return
    }
    if (kind === '7d') {
      const start = new Date(today)
      start.setDate(start.getDate() - 6)
      apply(toIsoDate(start), isoToday)
      return
    }
    if (kind === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      apply(toIsoDate(start), isoToday)
    }
  }

  return (
    <div className={`date-range-filter${open ? ' is-open' : ''}${active ? ' is-active' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`btn btn-ghost date-range-trigger${active ? ' is-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <FontAwesomeIcon icon={faCalendarDays} aria-hidden="true" />
        <span className="truncate">{formatLabel(dateFrom, dateTo, t, lang)}</span>
        {active ? (
          <span
            className="date-range-clear"
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              clear()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                clear()
              }
            }}
            aria-label={t('dateFilterClear')}
          >
            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="date-range-panel" role="dialog" aria-label={t('dateFilter')}>
          <div className="date-range-modes">
            <button
              type="button"
              className={mode === 'single' ? 'is-active' : ''}
              onClick={() => {
                setMode('single')
                setDraftTo(draftFrom)
              }}
            >
              {t('dateFilterSingle')}
            </button>
            <button
              type="button"
              className={mode === 'range' ? 'is-active' : ''}
              onClick={() => setMode('range')}
            >
              {t('dateFilterRange')}
            </button>
          </div>

          <div className="date-range-presets">
            <button type="button" onClick={() => preset('today')}>{t('datePresetToday')}</button>
            <button type="button" onClick={() => preset('7d')}>{t('datePresetLast7')}</button>
            <button type="button" onClick={() => preset('month')}>{t('datePresetThisMonth')}</button>
          </div>

          <div className="date-range-month-nav">
            <button type="button" className="chat-icon-btn" onClick={() => setViewMonth((m) => addMonths(m, -1))} aria-label={t('back')}>
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
            <strong>{monthLabel}</strong>
            <button type="button" className="chat-icon-btn" onClick={() => setViewMonth((m) => addMonths(m, 1))} aria-label={t('next')}>
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>

          <div className="date-range-weekdays" aria-hidden="true">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="date-range-grid">
            {cells.map((day, idx) => {
              if (!day) return <span key={`e-${idx}`} className="date-range-day is-empty" />
              const selected = isSelected(day)
              const endpoint = isEndpoint(day)
              return (
                <button
                  key={toIsoDate(day)}
                  type="button"
                  className={`date-range-day${selected ? ' is-selected' : ''}${endpoint ? ' is-endpoint' : ''}`}
                  onClick={() => pickDay(day)}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>

          <div className="date-range-footer">
            <span className="date-range-hint">
              {mode === 'single'
                ? t('dateFilterSingleHint')
                : draftFrom && !draftTo
                  ? t('dateFilterPickEnd')
                  : t('dateFilterRangeHint')}
            </span>
            <button type="button" className="btn btn-ghost" onClick={clear}>
              {t('dateFilterClear')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
