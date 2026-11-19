import { useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ChatMessageBody } from './ChatMessageBody'
import ChatMessageReceipt from './ChatMessageReceipt'
import { faCheck, faPenToSquare, faReply, faTrash, faXmark } from '../lib/icons'

function formatTime(iso, lang) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString(lang === 'my' ? 'my-MM' : undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

const SWIPE_TRIGGER = 72

export default function ChatMessageRow({
  message,
  mine,
  isStaff,
  onReply,
  onEdit,
  onDelete,
  t,
  lang,
}) {
  const [offsetX, setOffsetX] = useState(0)
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const touchRef = useRef(null)
  // Keep file on a solid bubble — transparent rich chrome makes white
  // file labels invisible in light mode (same issue voice had).
  const rich = ['image', 'gif', 'sticker'].includes(message.type)
  const canEditBody = mine && message.type === 'text'
  const canDelete = mine || isStaff

  function beginEdit() {
    if (!canEditBody) return
    setEditDraft(message.body || '')
    setEditing(true)
  }

  async function saveEdit() {
    const next = editDraft.trim()
    if (!next || next === String(message.body || '').trim()) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onEdit?.(message.id, next)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!canDelete || deleting) return
    const ok = window.confirm(t('chatDeleteConfirm'))
    if (!ok) return
    setDeleting(true)
    try {
      await onDelete?.(message.id)
    } finally {
      setDeleting(false)
    }
  }

  function onTouchStart(e) {
    if (editing) return
    const touch = e.touches?.[0]
    if (!touch) return
    touchRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      active: true,
      locked: false,
    }
  }

  function onTouchMove(e) {
    const state = touchRef.current
    const touch = e.touches?.[0]
    if (!state?.active || !touch) return
    const dx = touch.clientX - state.x
    const dy = touch.clientY - state.y
    if (!state.locked) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        state.active = false
        setOffsetX(0)
        return
      }
      if (Math.abs(dx) > 10) state.locked = true
    }
    if (!state.locked) return
    // Swipe toward reply affordance: others → right, mine → left
    const next = mine ? Math.min(0, Math.max(-110, dx)) : Math.max(0, Math.min(110, dx))
    setOffsetX(next)
  }

  function onTouchEnd() {
    const state = touchRef.current
    touchRef.current = null
    const triggered = Math.abs(offsetX) >= SWIPE_TRIGGER
    setOffsetX(0)
    if (triggered && state?.locked) onReply?.(message)
  }

  function replyLabel() {
    const reply = message.reply_to
    if (!reply) return null
    const name = Number(reply.sender_id) === Number(message.sender_id) && mine
      ? t('chatYou')
      : (reply.sender_name || t('customer'))
    return name
  }

  return (
    <div
      className={`chat-bubble-row${mine ? ' is-mine' : ''}${offsetX ? ' is-swiping' : ''}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        touchRef.current = null
        setOffsetX(0)
      }}
    >
      <div className="chat-swipe-hint" aria-hidden="true">
        <FontAwesomeIcon icon={faReply} />
      </div>
      <div
        className={`chat-bubble${mine ? ' is-mine' : ''}${rich ? ' is-rich' : ''}`}
        style={offsetX ? { transform: `translateX(${offsetX}px)` } : undefined}
      >
        {!mine ? (
          <div className="chat-bubble-name">
            {isStaff ? (message.sender?.name || t('memberApp')) : t('chatSupportAgent')}
          </div>
        ) : null}

        {message.reply_to ? (
          <button
            type="button"
            className="chat-reply-quote"
            onClick={() => onReply?.(message.reply_to)}
          >
            <strong className="truncate">{replyLabel()}</strong>
            <span className="truncate">{message.reply_to.body}</span>
          </button>
        ) : null}

        {editing ? (
          <div className="chat-inline-edit">
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={3}
              maxLength={4000}
              disabled={saving}
              aria-label={t('chatEditMessage')}
            />
            <div className="chat-inline-edit-actions">
              <button
                type="button"
                className="chat-icon-btn"
                onClick={() => setEditing(false)}
                disabled={saving}
                aria-label={t('dismiss')}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
              <button
                type="button"
                className="chat-icon-btn"
                onClick={saveEdit}
                disabled={saving || !editDraft.trim()}
                aria-label={t('save')}
              >
                <FontAwesomeIcon icon={faCheck} />
              </button>
            </div>
          </div>
        ) : (
          <ChatMessageBody message={message} mine={mine} t={t} />
        )}

        <div className="chat-bubble-meta">
          {message.edited_at ? <span className="chat-edited-tag">{t('chatEdited')}</span> : null}
          <span className="chat-bubble-time">{formatTime(message.created_at, lang)}</span>
          {mine ? <ChatMessageReceipt message={message} t={t} /> : null}
        </div>

        {!editing ? (
          <div className="chat-bubble-actions">
            <button
              type="button"
              className="chat-bubble-action"
              onClick={() => onReply?.(message)}
              aria-label={t('chatReply')}
              title={t('chatReply')}
            >
              <FontAwesomeIcon icon={faReply} aria-hidden="true" />
            </button>
            {canEditBody ? (
              <button
                type="button"
                className="chat-bubble-action"
                onClick={beginEdit}
                aria-label={t('chatEditMessage')}
                title={t('chatEditMessage')}
              >
                <FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" />
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                className="chat-bubble-action"
                onClick={confirmDelete}
                disabled={deleting}
                aria-label={t('chatDeleteMessage')}
                title={t('chatDeleteMessage')}
              >
                <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
