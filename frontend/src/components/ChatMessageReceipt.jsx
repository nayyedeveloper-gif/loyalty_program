import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faCheckDouble } from '../lib/icons'

export function messageDeliveryStatus(message) {
  if (!message) return 'sent'
  if (message.delivery_status) return message.delivery_status
  if (message.read_at) return 'seen'
  if (message.delivered_at) return 'delivered'
  return 'sent'
}

export default function ChatMessageReceipt({ message, t }) {
  const status = messageDeliveryStatus(message)
  const label =
    status === 'seen'
      ? t('chatReceiptSeen')
      : status === 'delivered'
        ? t('chatReceiptDelivered')
        : t('chatReceiptSent')

  return (
    <span
      className={`chat-receipt is-${status}`}
      title={label}
      aria-label={label}
    >
      <FontAwesomeIcon
        icon={status === 'sent' ? faCheck : faCheckDouble}
        aria-hidden="true"
      />
    </span>
  )
}
