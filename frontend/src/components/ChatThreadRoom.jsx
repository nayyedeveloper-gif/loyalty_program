import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { pickVoiceMime } from './ChatMessageBody'
import ChatMessageRow from './ChatMessageRow'
import ChatPhotoPicker from './ChatPhotoPicker'
import { CHAT_EMOJIS, formatDuration } from '../lib/chatMedia'
import { fetchGifCategories, fetchGifs, gifSearchPlaceholder } from '../lib/gifApi'
import {
  faChartLine,
  faChevronLeft,
  faFaceSmile,
  faImage,
  faMagnifyingGlass,
  faMicrophone,
  faPaperclip,
  faPaperPlane,
  faStar,
  faStop,
  faReply,
  faXmark,
} from '../lib/icons'

export default function ChatThreadRoom({
  user,
  isStaff = false,
  activeConversation,
  messages = [],
  loadingThread = false,
  sending = false,
  typingLabel = '',
  sendMessage,
  editMessage,
  deleteMessage,
  notifyTyping,
  title,
  subtitle,
  headerLeading = null,
  headerActions = null,
  t,
  lang,
}) {
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [picker, setPicker] = useState(null)
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

  const showGifResults = !!gifDebouncedQuery.trim() || !!gifCategory
  const pickerOpen = picker === 'gif' || picker === 'emoji' || picker === 'photo'
  const canSendText = !!draft.trim() && !sending && !!activeConversation

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, typingLabel, activeConversation?.id])

  useEffect(() => {
    inputRef.current?.focus()
    setReplyTo(null)
  }, [activeConversation?.id])

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
  }, [picker])

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

  async function sendPhotoFile(file) {
    if (!file || !activeConversation || sending) return
    setPicker(null)
    notifyTyping?.(false)
    await dispatchSend({
      type: 'image',
      file,
      body: '📷 Photo',
    })
  }

  async function onSubmit(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || !activeConversation) return
    setDraft('')
    setPicker(null)
    resetGifBrowse()
    notifyTyping?.(false)
    try {
      await dispatchSend({ type: 'text', body: text })
    } catch {
      setDraft(text)
    }
  }

  function onDraftChange(value) {
    setDraft(value)
    if (value.trim()) notifyTyping?.(true)
    else notifyTyping?.(false)
  }

  function insertEmoji(emoji) {
    setDraft((prev) => `${prev}${emoji}`)
    notifyTyping?.(true)
    inputRef.current?.focus()
  }

  async function sendGif(gif) {
    setPicker(null)
    resetGifBrowse()
    notifyTyping?.(false)
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
    if (!file || !activeConversation) return
    const isImage = file.type.startsWith('image/')
    setPicker(null)
    notifyTyping?.(false)
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
        notifyTyping?.(false)
        try {
          await dispatchSend({
            type: 'voice',
            file,
            durationMs: duration,
            body: '🎤 Voice message',
          })
        } catch {
          // context shows error
        }
      }
      mediaRecorderRef.current = recorder
      recordStartedAtRef.current = Date.now()
      setRecording(true)
      setRecordMs(0)
      setPicker(null)
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

  return (
    <div className="chat-thread-room">
      <header className="chat-inbox-thread-head">
        <div className="chat-panel-head-main">
          {headerLeading}
          <div className="min-w-0">
            <div className="chat-panel-title truncate">{title}</div>
            <div className="chat-panel-subtitle">{subtitle}</div>
          </div>
        </div>
        <div className="chat-panel-head-actions">
          {headerActions}
        </div>
      </header>

      {!activeConversation ? (
        <div className="chat-empty is-select">
          {isStaff ? t('chatSelectConversation') : t('loading')}
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
                onDelete={deleteMessage}
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
                      {!gifConfigured ? (
                        <div className="chat-gif-empty">{gifError || t('chatGifNeedsKey')}</div>
                      ) : null}
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
  )
}
