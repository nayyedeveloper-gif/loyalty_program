import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useChat } from '../context/ChatContext'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { mediaUrl } from '../lib/api'
import {
  CHAT_EMOJIS,
  formatDuration,
  previewMessageText,
} from '../lib/chatMedia'
import { fetchGifCategories, fetchGifs, gifSearchPlaceholder } from '../lib/gifApi'
import { useChatCall } from '../hooks/useChatCall'
import ChatCallOverlay from './ChatCallOverlay'
import ChatMessageRow from './ChatMessageRow'
import ChatPhotoPicker from './ChatPhotoPicker'
import ChatStartCustomerModal from './ChatStartCustomerModal'
import {
  faChartLine,
  faComments,
  faChevronLeft,
  faArrowUpRightFromSquare,
  faFaceSmile,
  faFile,
  faImage,
  faMagnifyingGlass,
  faMicrophone,
  faPaperclip,
  faPaperPlane,
  faPause,
  faPhone,
  faPlay,
  faPlus,
  faReply,
  faStar,
  faStop,
  faXmark,
} from '../lib/icons'

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
        // Some browsers need an explicit load after src rewrite via proxy.
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

function MessageBody({ message, mine, t }) {
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
    return (
      <a className="chat-image-msg" href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={message.attachment_name || t('chatPhoto')} />
      </a>
    )
  }

  if (type === 'voice' && url) {
    return <VoiceNote url={url} durationMs={message.duration_ms} mine={mine} t={t} />
  }

  if (type === 'file' && url) {
    return (
      <a className="chat-file-msg" href={url} target="_blank" rel="noreferrer" download={message.attachment_name || true}>
        <FontAwesomeIcon icon={faFile} aria-hidden="true" />
        <span className="truncate">{message.attachment_name || t('chatFile')}</span>
      </a>
    )
  }

  return <div className="chat-bubble-body">{message.body}</div>
}

export default function ChatWidget() {
  const { user } = useAuth()
  const { t, lang } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const onInboxPage = location.pathname.startsWith('/admin/inbox')
    || location.pathname.startsWith('/app/inbox')
  const {

    open,
    view,
    setView,
    conversations,
    activeConversation,
    messages,
    unreadCount,
    loadingInbox,
    loadingThread,
    sending,
    error,
    isStaff,
    openMessenger,
    closeMessenger,
    openConversation,
    startConversationWithCustomer,
    closeConversation,
    loadConversations,
    sendMessage,
    editMessage,
    typingLabel,
    notifyTyping,
  } = useChat()

  const onIncomingInvite = useMemo(
    () => (conversationId) => {
      openMessenger({ conversationId: conversationId || null })
    },
    [openMessenger],
  )
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [startOpen, setStartOpen] = useState(false)
  const [inboxSearch, setInboxSearch] = useState('')
  const [picker, setPicker] = useState(null) // gif | emoji | photo | null
  const inboxSearchTimerRef = useRef(null)
  const [gifCategory, setGifCategory] = useState(null)
  const [gifQuery, setGifQuery] = useState('')
  const [gifDebouncedQuery, setGifDebouncedQuery] = useState('')
  const [gifCategories, setGifCategories] = useState([])
  const [gifResults, setGifResults] = useState([])
  const [gifProvider, setGifProvider] = useState('none')
  const [gifConfigured, setGifConfigured] = useState(false)
  const [gifLoading, setGifLoading] = useState(false)
  const [gifError, setGifError] = useState('')
  const [photoRecents, setPhotoRecents] = useState([])
  const [recording, setRecording] = useState(false)
  const [recordMs, setRecordMs] = useState(0)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const fileRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordChunksRef = useRef([])
  const recordTimerRef = useRef(null)
  const recordStartedAtRef = useRef(0)
  const gifRequestIdRef = useRef(0)

  const title = useMemo(() => {
    if (!isStaff) return t('chatSupportTitle')
    if (view === 'thread' && activeConversation?.customer?.name) {
      return activeConversation.customer.name
    }
    return t('chatInboxTitle')
  }, [isStaff, view, activeConversation, t])

  const callPeerName = useMemo(() => {
    if (isStaff) return activeConversation?.customer?.name || t('customer')
    return t('chatSupportAgent')
  }, [isStaff, activeConversation, t])

  const inThread = !isStaff || view === 'thread'
  const canCall = !!activeConversation?.id && inThread && !sending
  const showCompactInbox = isStaff && view === 'inbox'

  useEffect(() => {
    if (!isStaff || !showCompactInbox || !open) return undefined
    if (inboxSearchTimerRef.current) window.clearTimeout(inboxSearchTimerRef.current)
    inboxSearchTimerRef.current = window.setTimeout(() => {
      loadConversations({ search: inboxSearch })
    }, 280)
    return () => {
      if (inboxSearchTimerRef.current) window.clearTimeout(inboxSearchTimerRef.current)
    }
  }, [inboxSearch, isStaff, loadConversations, open, showCompactInbox])

  async function selectStaffConversation(row) {
    const customerId = row.customer_id || row.customer?.id
    if (row.status === 'closed' && customerId) {
      await startConversationWithCustomer(customerId)
    } else {
      await openConversation(row.id)
    }
    setInboxSearch('')
  }

  const {
    call,
    muted,
    error: callError,
    remoteAudioRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
  } = useChatCall({
    user,
    conversationId: activeConversation?.id || null,
    peerName: callPeerName,
    isStaff,
    onIncomingInvite,
  })

  const showGifResults = !!gifDebouncedQuery.trim() || !!gifCategory

  useEffect(() => {
    if (!open) return
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, open, view, typingLabel])

  useEffect(() => {
    if (open && view === 'thread') {
      inputRef.current?.focus()
    }
    setReplyTo(null)
  }, [open, view, activeConversation?.id])

  useEffect(() => () => {
    if (recordTimerRef.current) window.clearInterval(recordTimerRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // ignore
      }
    }
    photoRecents.forEach((row) => {
      try {
        URL.revokeObjectURL(row.url)
      } catch {
        // ignore
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setGifDebouncedQuery(gifQuery), 280)
    return () => window.clearTimeout(timer)
  }, [gifQuery])

  useEffect(() => {
    if (picker !== 'gif') return undefined
    let cancelled = false
    ;(async () => {
      const res = await fetchGifCategories()
      if (cancelled) return
      setGifProvider(res.provider)
      setGifConfigured(res.configured)
      setGifCategories(res.categories)
      setGifError('')
    })()
    return () => { cancelled = true }
  }, [picker, t])

  useEffect(() => {
    if (picker !== 'gif') return undefined
    if (!showGifResults) {
      setGifResults([])
      setGifLoading(false)
      return undefined
    }

    const q = gifDebouncedQuery.trim() || gifCategory?.query || ''
    const requestId = ++gifRequestIdRef.current
    setGifLoading(true)
    setGifError('')

    ;(async () => {
      const res = await fetchGifs({ q, limit: 24 })
      if (requestId !== gifRequestIdRef.current) return
      setGifProvider(res.provider)
      setGifConfigured(res.configured)
      setGifResults(res.gifs)
      setGifLoading(false)
      setGifError(res.configured ? '' : (res.message || t('chatGifEmpty')))
    })()

    return undefined
  }, [picker, showGifResults, gifDebouncedQuery, gifCategory, t])

  function resetGifBrowse() {
    setGifCategory(null)
    setGifQuery('')
    setGifDebouncedQuery('')
    setGifResults([])
    setGifError('')
  }

  function openPicker(tab) {
    setPicker((prev) => {
      if (prev === tab) {
        resetGifBrowse()
        return null
      }
      if (tab !== 'gif') resetGifBrowse()
      return tab
    })
  }

  function pickerTitle() {
    if (picker === 'gif') return t('chatGifs')
    if (picker === 'emoji') return t('chatEmojis')
    if (picker === 'photo') return t('chatPhotos')
    return ''
  }

  function rememberPhotos(files) {
    const next = files
      .filter((file) => file?.type?.startsWith('image/'))
      .map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
        url: URL.createObjectURL(file),
        file,
      }))
    if (!next.length) return
    setPhotoRecents((prev) => {
      const merged = [...next, ...prev].slice(0, 24)
      const keep = new Set(merged.map((row) => row.id))
      prev.forEach((row) => {
        if (!keep.has(row.id)) {
          try {
            URL.revokeObjectURL(row.url)
          } catch {
            // ignore
          }
        }
      })
      return merged
    })
  }

  function withReply(payload) {
    if (!replyTo?.id) return payload
    return { ...payload, replyToMessageId: replyTo.id }
  }

  function clearReply() {
    setReplyTo(null)
  }

  async function dispatchSend(payload) {
    const message = await sendMessage(withReply(payload))
    clearReply()
    return message
  }

  async function sendPhotoFile(file) {
    if (!file || !activeConversation || sending) return
    setPicker(null)
    notifyTyping(false)
    await dispatchSend({
      type: 'image',
      file,
      body: '📷 Photo',
    })
  }

  async function onSubmit(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    setPicker(null)
    resetGifBrowse()
    notifyTyping(false)
    try {
      await dispatchSend({ type: 'text', body: text })
    } catch {
      setDraft(text)
    }
  }

  function onDraftChange(value) {
    setDraft(value)
    if (value.trim()) notifyTyping(true)
    else notifyTyping(false)
  }

  async function insertEmoji(emoji) {
    setDraft((prev) => `${prev}${emoji}`)
    notifyTyping(true)
    inputRef.current?.focus()
  }

  async function sendGif(gif) {
    setPicker(null)
    resetGifBrowse()
    notifyTyping(false)
    await dispatchSend({
      type: 'gif',
      body: 'GIF',
      gifUrl: gif.url,
      gifId: gif.id,
    })
  }

  async function onPickFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const isImage = file.type.startsWith('image/')
    setPicker(null)
    notifyTyping(false)
    await dispatchSend({
      type: isImage ? 'image' : 'file',
      file,
      body: isImage ? '📷 Photo' : `📎 ${file.name}`,
    })
  }

  async function startRecording() {
    if (recording || sending || !activeConversation) return
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      window.alert(t('chatVoiceUnsupported'))
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      })
      const mime = pickVoiceMime()
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128000 })
        : new MediaRecorder(stream)
      recordChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data?.size) recordChunksRef.current.push(event.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current)
          recordTimerRef.current = null
        }
        const duration = Date.now() - recordStartedAtRef.current
        setRecording(false)
        setRecordMs(0)
        const mimeType = (recorder.mimeType || mime || 'audio/webm').split(';')[0]
        const blob = new Blob(recordChunksRef.current, { type: mimeType })
        recordChunksRef.current = []
        if (blob.size < 800 || duration < 400) return
        const ext = mimeType.includes('mp4') ? 'm4a' : (mimeType.includes('ogg') ? 'ogg' : 'webm')
        const file = new File([blob], `voice-${Date.now()}.${ext}`, {
          type: mimeType.startsWith('audio/') ? mimeType : 'audio/webm',
        })
        notifyTyping(false)
        try {
          await dispatchSend({
            type: 'voice',
            file,
            durationMs: duration,
            body: '🎤 Voice message',
          })
        } catch {
          // keep UI quiet; error banner handled by context
        }
      }
      mediaRecorderRef.current = recorder
      recordStartedAtRef.current = Date.now()
      setRecording(true)
      setRecordMs(0)
      setPicker(null)
      // Timeslice keeps audio init segments intact and avoids silent/broken blobs.
      recorder.start(250)
      recordTimerRef.current = window.setInterval(() => {
        setRecordMs(Date.now() - recordStartedAtRef.current)
      }, 200)
    } catch {
      window.alert(t('chatMicDenied'))
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      setRecording(false)
      return
    }
    try {
      if (recorder.state === 'recording') recorder.requestData()
    } catch {
      // ignore
    }
    recorder.stop()
  }

  function handleCloseMessenger() {
    setPicker(null)
    resetGifBrowse()
    closeMessenger()
  }

  function openInboxPage() {
    handleCloseMessenger()
    if (isStaff) {
      // Staff land on the inbox list first; selecting a row opens the full thread.
      navigate('/admin/inbox')
      return
    }
    const conversationQuery = activeConversation?.id ? `?c=${activeConversation.id}` : ''
    navigate(`/app/inbox${conversationQuery}`)
  }

  if (!user || typeof document === 'undefined') return null
  // Full inbox page owns the messenger UI — keep the floating widget for calls only there.
  if (onInboxPage && !call) return null

  const canSendText = !!draft.trim() && !sending && !!activeConversation
  const pickerOpen = picker === 'gif' || picker === 'emoji' || picker === 'photo'

  return createPortal(
    <div className="chat-widget-root">
      {!onInboxPage ? (
        <button
          type="button"
          className={`chat-fab${open ? ' is-open' : ''}`}
          onClick={() => (open ? handleCloseMessenger() : openMessenger())}
          aria-label={t('chatOpen')}
          title={t('chatOpen')}
        >
          <FontAwesomeIcon icon={open ? faXmark : faComments} aria-hidden="true" />
          {!open && unreadCount > 0 ? (
            <span className="chat-fab-badge" aria-label={t('chatUnread', { count: unreadCount })}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>
      ) : null}

      <div
        className={`chat-panel${open || call ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="false"
        aria-label={t('chatSupportTitle')}
        aria-hidden={!open && !call}
      >
        <header className="chat-panel-head">
          <div className="chat-panel-head-main">
            {isStaff && view === 'thread' ? (
              <button
                type="button"
                className="chat-icon-btn"
                onClick={() => {
                  setView('inbox')
                  setPicker(null)
                  resetGifBrowse()
                }}
                aria-label={t('chatBackToInbox')}
              >
                <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
              </button>
            ) : null}
            <div className="min-w-0">
              <div className="chat-panel-title truncate">{title}</div>
              <div className="chat-panel-subtitle">
                {isStaff && view === 'thread' && activeConversation?.customer?.customer_code
                  ? activeConversation.customer.customer_code
                  : t('chatSupportSubtitle')}
              </div>
            </div>
          </div>
          <div className="chat-panel-head-actions">
            {canCall ? (
              <button
                type="button"
                className="chat-icon-btn chat-call-head-btn"
                onClick={() => startCall()}
                aria-label={t('chatCallAudio')}
                title={t('chatCallAudio')}
                disabled={!!call}
              >
                <FontAwesomeIcon icon={faPhone} aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              className="chat-icon-btn"
              onClick={openInboxPage}
              aria-label={isStaff ? t('chatOpenInboxPage') : t('chatExpand')}
              title={isStaff ? t('chatOpenInboxPage') : t('chatExpand')}
            >
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="chat-icon-btn"
              onClick={handleCloseMessenger}
              aria-label={t('dismiss')}
            >
              <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
            </button>
          </div>
        </header>

        <ChatCallOverlay
          call={call}
          muted={muted}
          error={callError}
          remoteAudioRef={remoteAudioRef}
          onAccept={acceptCall}
          onReject={rejectCall}
          onEnd={endCall}
          onToggleMute={toggleMute}
          t={t}
        />

        {error ? <div className="chat-error">{error}</div> : null}

        {showCompactInbox ? (
          <div className="chat-inbox-stack">
            <div className="chat-inbox-search">
              <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
              <label className="sr-only" htmlFor="chat-widget-inbox-search">
                {t('chatSearchConversations')}
              </label>
              <input
                id="chat-widget-inbox-search"
                type="search"
                value={inboxSearch}
                onChange={(e) => setInboxSearch(e.target.value)}
                placeholder={t('chatSearchConversations')}
                autoComplete="off"
              />
            </div>
            <div className="chat-inbox" ref={listRef}>
              {loadingInbox ? <div className="chat-empty">{t('loading')}</div> : null}
              {!loadingInbox && conversations.length === 0 ? (
                <div className="chat-empty">
                  {inboxSearch.trim() ? t('chatNoSearchResults') : t('chatNoConversations')}
                </div>
              ) : null}
              {conversations.map((row) => {
                const closed = row.status === 'closed'
                return (
                  <div key={row.id} className={`chat-inbox-row${closed ? ' is-closed' : ''}`}>
                    <button
                      type="button"
                      className="chat-inbox-row-main"
                      onClick={() => selectStaffConversation(row)}
                    >
                      <div className="chat-avatar" aria-hidden="true">
                        {row.customer?.avatar_url ? (
                          <img src={mediaUrl(row.customer.avatar_url)} alt="" />
                        ) : (
                          (row.customer?.name || '?').slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div className="chat-inbox-copy min-w-0">
                        <div className="chat-inbox-top">
                          <strong className="truncate">{row.customer?.name || t('customer')}</strong>
                          <span>{formatTime(row.last_message_at || row.latest_message?.created_at, lang)}</span>
                        </div>
                        <div className="chat-inbox-preview truncate">
                          {closed
                            ? t('chatClosedConversation')
                            : previewMessageText(row.latest_message, t('chatNoMessagesYet'))}
                        </div>
                      </div>
                      {closed ? (
                        <span className="chat-inbox-closed-tag">{t('chatClosed')}</span>
                      ) : row.unread_count > 0 ? (
                        <span className="chat-inbox-unread">{row.unread_count > 99 ? '99+' : row.unread_count}</span>
                      ) : null}
                    </button>
                    {!closed ? (
                      <button
                        type="button"
                        className="chat-inbox-close"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          closeConversation(row.id)
                        }}
                        aria-label={t('chatCloseConversation')}
                        title={t('chatCloseConversation')}
                      >
                        <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
            <button
              type="button"
              className="chat-start-fab"
              onClick={() => setStartOpen(true)}
              aria-label={t('chatStartWithCustomer')}
              title={t('chatStartWithCustomer')}
            >
              <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <div className="chat-thread" ref={listRef}>
              {loadingThread ? <div className="chat-empty">{t('loading')}</div> : null}
              {!loadingThread && messages.length === 0 ? (
                <div className="chat-empty">{t('chatStartPrompt')}</div>
              ) : null}
              {messages.map((msg) => (
                <ChatMessageRow
                  key={msg.id}
                  message={msg}
                  mine={msg.sender_id === user.id}
                  isStaff={isStaff}
                  onReply={(target) => {
                    setReplyTo(target)
                    inputRef.current?.focus()
                  }}
                  onEdit={editMessage}
                  t={t}
                  lang={lang}
                />
              ))}
              {typingLabel ? (
                <div className="chat-typing" aria-live="polite">
                  <span className="chat-typing-label">
                    {t('chatIsTyping', { name: typingLabel })}
                  </span>
                  <span className="chat-typing-dots" aria-hidden="true">
                    <i /><i /><i />
                  </span>
                </div>
              ) : null}
            </div>

            {pickerOpen ? (
              <div className={`chat-expr-picker${picker === 'photo' ? ' is-photo' : ''}`}>
                {picker === 'photo' ? <div className="chat-photo-sheet-handle" aria-hidden="true" /> : null}
                <div className="chat-expr-head">
                  <span className="chat-expr-title">{pickerTitle()}</span>
                  <button
                    type="button"
                    className="chat-expr-close"
                    onClick={() => {
                      setPicker(null)
                      resetGifBrowse()
                    }}
                    aria-label={t('dismiss')}
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                </div>

                {picker === 'photo' ? (
                  <ChatPhotoPicker
                    photos={photoRecents}
                    disabled={!activeConversation || sending}
                    onPhotosLoaded={rememberPhotos}
                    onSendPhoto={sendPhotoFile}
                    t={t}
                  />
                ) : null}

                {picker === 'gif' ? (
                  <>
                    <div className="chat-expr-search">
                      {showGifResults ? (
                        <button
                          type="button"
                          className="chat-expr-back"
                          onClick={resetGifBrowse}
                          aria-label={t('dismiss')}
                        >
                          <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                      ) : null}
                      <label className="chat-expr-search-field">
                        <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
                        <input
                          type="search"
                          value={gifQuery}
                          onChange={(e) => {
                            setGifQuery(e.target.value)
                            if (e.target.value.trim()) setGifCategory(null)
                          }}
                          placeholder={gifSearchPlaceholder(gifProvider, t)}
                          aria-label={gifSearchPlaceholder(gifProvider, t)}
                        />
                        {gifQuery ? (
                          <button
                            type="button"
                            className="chat-expr-clear"
                            onClick={() => {
                              setGifQuery('')
                              setGifDebouncedQuery('')
                            }}
                            aria-label={t('dismiss')}
                          >
                            <FontAwesomeIcon icon={faXmark} />
                          </button>
                        ) : null}
                      </label>
                    </div>

                    {showGifResults ? (
                      <div className="chat-expr-body">
                        {gifCategory && !gifQuery.trim() ? (
                          <div className="chat-expr-section-label">{gifCategory.label}</div>
                        ) : null}
                        {gifLoading ? <div className="chat-gif-empty">{t('loading')}</div> : null}
                        {!gifLoading && gifError ? <div className="chat-gif-empty">{gifError}</div> : null}
                        {!gifLoading && !gifError ? (
                          <div className="chat-gif-results">
                            {gifResults.length === 0 ? (
                              <div className="chat-gif-empty">{t('chatGifEmpty')}</div>
                            ) : (
                              gifResults.map((gif) => (
                                <button
                                  key={gif.id}
                                  type="button"
                                  className="chat-gif-result"
                                  onClick={() => sendGif(gif)}
                                  title={gif.title}
                                  aria-label={gif.title}
                                >
                                  <img src={gif.preview_url || gif.url} alt={gif.title} loading="lazy" />
                                </button>
                              ))
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="chat-expr-body">
                        <div className="chat-gif-categories">
                          {gifCategories.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              className={`chat-gif-category tint-${cat.tint || 'grey'}`}
                              onClick={() => setGifCategory(cat)}
                            >
                              {cat.cover ? <img src={cat.cover} alt="" loading="lazy" /> : <span className="chat-gif-category-fallback" />}
                              <span className="chat-gif-category-label">
                                {cat.icon === 'star' ? <FontAwesomeIcon icon={faStar} aria-hidden="true" /> : null}
                                {cat.icon === 'chart' ? <FontAwesomeIcon icon={faChartLine} aria-hidden="true" /> : null}
                                {cat.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : null}

                {picker === 'emoji' ? (
                  <div className="chat-expr-body">
                    <div className="chat-emoji-grid">
                      {CHAT_EMOJIS.map((emoji) => (
                        <button key={emoji} type="button" onClick={() => insertEmoji(emoji)}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {replyTo ? (
              <div className="chat-reply-bar">
                <FontAwesomeIcon icon={faReply} aria-hidden="true" />
                <div className="chat-reply-bar-copy min-w-0">
                  <strong className="truncate">
                    {t('chatReplyingTo', {
                      name: replyTo.sender?.name || replyTo.sender_name || t('customer'),
                    })}
                  </strong>
                  <span className="truncate">
                    {replyTo.body || (replyTo.type === 'image' ? '📷 Photo' : '')}
                  </span>
                </div>
                <button type="button" className="chat-icon-btn" onClick={clearReply} aria-label={t('dismiss')}>
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
            ) : null}

            {recording ? (
              <div className="chat-recording-bar">
                <span className="chat-recording-dot" aria-hidden="true" />
                <span>{t('chatRecording', { time: formatDuration(recordMs) })}</span>
                <button type="button" className="chat-send-btn is-stop" onClick={stopRecording} aria-label={t('chatStopRecording')}>
                  <FontAwesomeIcon icon={faStop} />
                </button>
              </div>
            ) : (
              <form className="chat-composer" onSubmit={onSubmit}>
                <input
                  ref={fileRef}
                  type="file"
                  className="sr-only"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,audio/*"
                  onChange={onPickFile}
                />
                <div className="chat-composer-tools">
                  <button
                    type="button"
                    className={`chat-tool-btn${picker === 'photo' ? ' is-active' : ''}`}
                    onClick={() => openPicker('photo')}
                    aria-label={t('chatPhotos')}
                    disabled={!activeConversation || sending}
                  >
                    <FontAwesomeIcon icon={faImage} />
                  </button>
                  <button
                    type="button"
                    className={`chat-tool-btn${picker === 'emoji' ? ' is-active' : ''}`}
                    onClick={() => openPicker('emoji')}
                    aria-label={t('chatEmojis')}
                    disabled={!activeConversation || sending}
                  >
                    <FontAwesomeIcon icon={faFaceSmile} />
                  </button>
                  <button
                    type="button"
                    className={`chat-tool-btn chat-gif-btn${picker === 'gif' ? ' is-active' : ''}`}
                    onClick={() => openPicker('gif')}
                    aria-label={t('chatGifs')}
                    disabled={!activeConversation || sending}
                  >
                    <span className="chat-gif-badge" aria-hidden="true">GIF</span>
                  </button>
                  <button
                    type="button"
                    className="chat-tool-btn"
                    onClick={() => fileRef.current?.click()}
                    aria-label={t('chatAttach')}
                    disabled={!activeConversation || sending}
                  >
                    <FontAwesomeIcon icon={faPaperclip} />
                  </button>
                  <button
                    type="button"
                    className="chat-tool-btn"
                    onClick={startRecording}
                    aria-label={t('chatVoice')}
                    disabled={!activeConversation || sending}
                  >
                    <FontAwesomeIcon icon={faMicrophone} />
                  </button>
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  placeholder={t('chatMessagePlaceholder')}
                  maxLength={4000}
                  disabled={sending || !activeConversation}
                  aria-label={t('chatMessagePlaceholder')}
                />
                <button
                  type="submit"
                  className="chat-send-btn"
                  disabled={!canSendText}
                  aria-label={t('chatSend')}
                >
                  <FontAwesomeIcon icon={faPaperPlane} aria-hidden="true" />
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {isStaff ? (
        <ChatStartCustomerModal
          open={startOpen}
          onClose={() => setStartOpen(false)}
          onStarted={startConversationWithCustomer}
          t={t}
        />
      ) : null}
    </div>,
    document.body,
  )
}
