import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { mediaUrl } from '../lib/api'
import { formatDuration } from '../lib/chatMedia'
import { faDownload, faFile, faPause, faPlay } from '../lib/icons'

async function downloadAttachment(url, filename) {
  if (!url) return
  const name = filename || 'download'
  try {
    const token = localStorage.getItem('token')
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!response.ok) throw new Error('download failed')
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = name
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  } catch {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.target = '_blank'
    anchor.rel = 'noreferrer'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }
}

function AttachmentDownloadButton({ url, filename, t, className = '' }) {
  const [busy, setBusy] = useState(false)

  async function onDownload(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!url || busy) return
    setBusy(true)
    try {
      await downloadAttachment(url, filename)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={`chat-download-btn${className ? ` ${className}` : ''}`}
      onClick={onDownload}
      disabled={busy}
      aria-label={t('chatDownload')}
      title={t('chatDownload')}
    >
      <FontAwesomeIcon icon={faDownload} aria-hidden="true" />
    </button>
  )
}

function pickVoiceMime() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || ''
}

function VoiceNote({ url, durationMs, mine, t }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentMs, setCurrentMs] = useState(0)
  const [failed, setFailed] = useState(false)
  const knownMs = Number(durationMs || 0)
  const totalMs = Math.max(knownMs, currentMs)
  const progress = totalMs > 0 ? Math.min(100, (currentMs / totalMs) * 100) : 0

  useEffect(() => {
    setPlaying(false)
    setCurrentMs(0)
    setFailed(false)
    const audio = audioRef.current
    if (!audio) return undefined
    audio.pause()
    audio.currentTime = 0
    return () => {
      audio.pause()
    }
  }, [url])

  async function togglePlay() {
    const audio = audioRef.current
    if (!audio || failed) return
    try {
      if (audio.paused) {
        audio.muted = false
        audio.volume = 1
        if (audio.readyState < 2) {
          audio.load()
        }
        await audio.play()
        setPlaying(true)
      } else {
        audio.pause()
        setPlaying(false)
      }
    } catch {
      setFailed(true)
      setPlaying(false)
    }
  }

  return (
    <div className={`chat-voice-note${mine ? ' is-mine' : ''}${failed ? ' is-failed' : ''}`}>
      <audio
        ref={audioRef}
        preload="auto"
        src={url}
        playsInline
        onTimeUpdate={(e) => setCurrentMs(Math.round((e.currentTarget.currentTime || 0) * 1000))}
        onEnded={() => {
          setPlaying(false)
          setCurrentMs(0)
        }}
        onError={() => {
          setFailed(true)
          setPlaying(false)
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      >
        <track kind="captions" />
      </audio>
      <button
        type="button"
        className="chat-voice-play"
        onClick={togglePlay}
        aria-label={playing ? t('chatStopRecording') : t('chatVoice')}
        disabled={failed}
      >
        <FontAwesomeIcon icon={playing ? faPause : faPlay} />
      </button>
      <div className="chat-voice-wave" aria-hidden="true">
        <span className="chat-voice-progress" style={{ width: `${progress}%` }} />
      </div>
      <span className="chat-voice-duration">
        {failed ? '—' : formatDuration(playing || currentMs > 0 ? currentMs : totalMs)}
      </span>
    </div>
  )
}

export function ChatMessageBody({ message, mine, t }) {
  const type = message.type || 'text'
  const url = message.attachment_url ? mediaUrl(message.attachment_url) : ''
  const gifUrl = message.meta?.gif_url || ''

  if (type === 'gif' && gifUrl) {
    return (
      <a className="chat-gif-msg" href={gifUrl} target="_blank" rel="noreferrer">
        <img src={gifUrl} alt={t('chatGif')} loading="lazy" />
      </a>
    )
  }

  if (type === 'sticker') {
    const stickerUrl = message.meta?.sticker_url || ''
    if (stickerUrl) {
      return (
        <div className="chat-sticker-media" aria-label={t('chatSticker')}>
          <img src={stickerUrl} alt={message.body || t('chatSticker')} loading="lazy" />
        </div>
      )
    }
    return <div className="chat-sticker-msg" aria-label={t('chatSticker')}>{message.body}</div>
  }

  if (type === 'image' && url) {
    const filename = message.attachment_name || 'photo.jpg'
    return (
      <div className="chat-media-with-download">
        <a className="chat-image-msg" href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={filename} />
        </a>
        <AttachmentDownloadButton url={url} filename={filename} t={t} />
      </div>
    )
  }

  if (type === 'voice' && url) {
    return <VoiceNote url={url} durationMs={message.duration_ms} mine={mine} t={t} />
  }

  if (type === 'file' && url) {
    const filename = message.attachment_name || t('chatFile')
    return (
      <div className="chat-file-row">
        <a className="chat-file-msg" href={url} target="_blank" rel="noreferrer">
          <FontAwesomeIcon icon={faFile} aria-hidden="true" />
          <span className="truncate">{filename}</span>
        </a>
        <AttachmentDownloadButton url={url} filename={filename} t={t} />
      </div>
    )
  }

  return <div className="chat-bubble-body">{message.body}</div>
}

export { pickVoiceMime }
