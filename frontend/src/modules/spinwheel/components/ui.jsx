import { motion, AnimatePresence } from 'motion/react'
import { useLanguage } from '../../../context/LanguageContext'

export function StatusBadge({ status, label }) {
  const key = status === 'ready_to_collect' ? 'ready' : status === 'no_collection_required' ? 'none' : status
  return <span className={`badge badge-${key}`}>{label || status}</span>
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="empty-state">
      <div className="empty-orb" aria-hidden />
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action}
    </div>
  )
}

export function Skeleton({ height = 16, width = '100%', radius = 8 }) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius }} />
}

export function Modal({ open, onClose, children, className = '', tone = 'customer' }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`modal-backdrop tone-${tone}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`modal-panel ${className}`}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy,
  tone = 'admin',
  danger = false,
}) {
  const { t } = useLanguage()
  const cancelClass = tone === 'customer' ? 'cx-ghost' : 'btn-admin'
  const confirmClass = tone === 'customer'
    ? 'btn-spin'
    : `admin-btn ${danger ? 'admin-btn-danger' : 'admin-btn-primary'}`

  return (
    <Modal open={open} onClose={busy ? undefined : onCancel} tone={tone} className="confirm-dialog">
      <h3>{title}</h3>
      <p>{body}</p>
      <div className="dialog-actions">
        <button type="button" className={cancelClass} onClick={onCancel} disabled={busy}>
          {cancelLabel || t('spinCancel')}
        </button>
        <button type="button" className={confirmClass} onClick={onConfirm} disabled={busy}>
          {busy ? t('spinWorking') : (confirmLabel || t('spinConfirmSpin'))}
        </button>
      </div>
    </Modal>
  )
}

export function Toast({ message, tone = 'ok', onDismiss }) {
  if (!message) return null
  return (
    <motion.div
      className={`toast toast-${tone}`}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <span>{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss">×</button>
      )}
    </motion.div>
  )
}
