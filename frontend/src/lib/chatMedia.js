export const CHAT_EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤗', '🤩',
  '😇', '🙂', '😉', '😭', '😤', '😅', '😆', '🤔', '😴', '🥺',
  '👍', '👎', '👏', '🙏', '💪', '🔥', '✨', '🎉', '❤️', '💙',
  '💛', '💚', '💜', '🖤', '🤍', '💯', '⭐', '🌟', '✅', '❌',
  '🎁', '💎', '👑', '🏆', '💍', '🪙', '💰', '📸', '🎵', '📌',
]

export function formatDuration(ms) {
  const total = Math.max(0, Math.round(Number(ms || 0) / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function previewMessageText(message, fallback = '') {
  if (!message) return fallback
  switch (message.type) {
    case 'image':
      return '📷 Photo'
    case 'gif':
      return 'GIF'
    case 'voice':
      return '🎤 Voice message'
    case 'file':
      return `📎 ${message.attachment_name || 'File'}`
    case 'sticker':
      return message.body || 'Sticker'
    default:
      return message.body || fallback
  }
}
