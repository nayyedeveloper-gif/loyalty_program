import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLanguage } from '../context/LanguageContext'
import { faGem, faTrash, faXmark } from '../lib/icons'
import Modal from './Modal'

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  busy = false,
  danger = true,
  confirmIcon,
  onConfirm,
  onCancel,
}) {
  const { t } = useLanguage()
  const icon = confirmIcon || (danger ? faTrash : faGem)

  return (
    <Modal open={open} onClose={busy ? () => {} : onCancel} title={title || t('confirmDeleteTitle')}>
      <div className="space-y-4">
        <p className="type-small text-[var(--color-muted)] m-0">{message}</p>
        <div className="action-row justify-end">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>
            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
            {cancelLabel || t('cancel')}
          </button>
          <button
            type="button"
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            disabled={busy}
            onClick={onConfirm}
          >
            <FontAwesomeIcon icon={icon} aria-hidden="true" />
            {busy ? t('saving') : confirmLabel || t('delete')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
