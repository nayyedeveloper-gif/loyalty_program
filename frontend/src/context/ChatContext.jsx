import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import api from '../lib/api'
import { connectEcho, disconnectEcho, getEcho } from '../lib/echo'
import { useAuth } from './AuthContext'
import { useNotifications } from './NotificationContext'

const ChatContext = createContext(null)
const UNREAD_POLL_MS = 12000

export function ChatProvider({ children }) {
  const { user } = useAuth()
  const { refreshUnread } = useNotifications()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState('inbox') // inbox | thread
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingInbox, setLoadingInbox] = useState(false)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [typingUsers, setTypingUsers] = useState([])
  const activeIdRef = useRef(null)
  const openRef = useRef(false)
  const typingIdleTimerRef = useRef(null)
  const lastTypingSentRef = useRef(0)
  const typingClearTimersRef = useRef({})
  const handleIncomingMessageRef = useRef(null)
  const applyTypingStateRef = useRef(null)
  const applyReceiptRef = useRef(null)
  const applyMessageUpdateRef = useRef(null)
  const seenMessageIdsRef = useRef(new Set())
  const isStaff = user?.role === 'admin' || user?.role === 'staff'

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    openRef.current = open
  }, [open])

  const refreshChatUnread = useCallback(async () => {
    if (!user?.id || !localStorage.getItem('token')) {
      setUnreadCount(0)
      return 0
    }
    try {
      const { data } = await api.get('/chat/unread-count')
      const next = Number(data.unread_count || 0)
      setUnreadCount(next)
      return next
    } catch {
      return 0
    }
  }, [user?.id])

  const loadConversations = useCallback(async ({ search = '' } = {}) => {
    if (!user?.id) return []
    setLoadingInbox(true)
    try {
      const trimmed = String(search || '').trim()
      const { data } = await api.get('/chat/conversations', {
        params: trimmed ? { search: trimmed } : undefined,
      })
      const rows = data.conversations || []
      setConversations(rows)
      setError('')
      return rows
    } catch (err) {
      setError(err?.message || 'Could not load chats.')
      return []
    } finally {
      setLoadingInbox(false)
    }
  }, [user?.id])

  const loadMessages = useCallback(async (conversationId, { afterId = 0 } = {}) => {
    if (!conversationId) return []
    if (!afterId) setLoadingThread(true)
    try {
      const { data } = await api.get(`/chat/conversations/${conversationId}/messages`, {
        params: afterId ? { after_id: afterId } : undefined,
      })
      const rows = data.messages || []
      if (afterId > 0) {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id))
          const merged = [...prev]
          rows.forEach((row) => {
            if (!seen.has(row.id)) merged.push(row)
          })
          return merged
        })
      } else {
        setMessages(rows)
      }
      setError('')
      return rows
    } catch (err) {
      setError(err?.message || 'Could not load messages.')
      return []
    } finally {
      if (!afterId) setLoadingThread(false)
    }
  }, [])

  const markRead = useCallback(async (conversationId) => {
    if (!conversationId) return
    // Clear badges immediately — don't wait on the network round-trip.
    setUnreadCount(0)
    setConversations((prev) =>
      prev.map((row) =>
        Number(row.id) === Number(conversationId) ? { ...row, unread_count: 0 } : row,
      ),
    )
    try {
      const { data } = await api.post(`/chat/conversations/${conversationId}/read`)
      if (data.conversation) {
        setConversations((prev) => {
          const others = prev.filter((c) => c.id !== data.conversation.id)
          return [{ ...data.conversation, unread_count: 0 }, ...others]
        })
      }
      await refreshChatUnread()
    } catch {
      // ignore
    }
  }, [refreshChatUnread])

  const openConversation = useCallback(async (conversationId) => {
    setActiveId(conversationId)
    setView('thread')
    // Mark read first so the badge clears while messages load.
    const readPromise = markRead(conversationId)
    await loadMessages(conversationId)
    await readPromise
  }, [loadMessages, markRead])

  const startConversationWithCustomer = useCallback(async (customerId) => {
    if (!customerId) return null
    setLoadingThread(true)
    setError('')
    try {
      const { data } = await api.post('/chat/conversations/start', { customer_id: customerId })
      const conversation = data.conversation
      if (!conversation?.id) throw new Error('Could not start chat.')
      setConversations((prev) => {
        const others = prev.filter((row) => Number(row.id) !== Number(conversation.id))
        return [conversation, ...others]
      })
      setActiveId(conversation.id)
      setView('thread')
      await loadMessages(conversation.id)
      await markRead(conversation.id)
      return conversation
    } catch (err) {
      setError(err?.message || 'Could not start chat.')
      throw err
    } finally {
      setLoadingThread(false)
    }
  }, [loadMessages, markRead])

  const closeConversation = useCallback(async (conversationId) => {
    if (!conversationId) return null
    setError('')
    try {
      const { data } = await api.post(`/chat/conversations/${conversationId}/close`)
      setConversations((prev) => prev.filter((row) => Number(row.id) !== Number(conversationId)))
      if (Number(activeIdRef.current) === Number(conversationId)) {
        setActiveId(null)
        setMessages([])
        setView('inbox')
      }
      await refreshChatUnread()
      return data.conversation || null
    } catch (err) {
      setError(err?.message || 'Could not close chat.')
      throw err
    }
  }, [refreshChatUnread])

  const openMessenger = useCallback(async ({ conversationId = null } = {}) => {
    setOpen(true)
    if (!user?.id) return

    if (user.role === 'customer') {
      setView('thread')
      // Incoming staff call already knows the conversation — open it directly
      // instead of racing a fresh /open request that can miss the ring UI.
      if (conversationId) {
        setActiveId(conversationId)
        setConversations((prev) => {
          if (prev.some((row) => Number(row.id) === Number(conversationId))) return prev
          return [{ id: conversationId }, ...prev]
        })
        await loadMessages(conversationId)
        await markRead(conversationId)
        return
      }
      setLoadingThread(true)
      try {
        const { data } = await api.post('/chat/conversations/open')
        const conversation = data.conversation
        setConversations([conversation])
        setActiveId(conversation.id)
        await loadMessages(conversation.id)
        await markRead(conversation.id)
      } catch (err) {
        setError(err?.message || 'Could not open chat.')
      } finally {
        setLoadingThread(false)
      }
      return
    }

    const rows = await loadConversations()
    if (conversationId) {
      await openConversation(conversationId)
      return
    }
    if (rows.length === 1) {
      await openConversation(rows[0].id)
      return
    }
    setView('inbox')
    setActiveId(null)
    setMessages([])
  }, [user, loadConversations, loadMessages, markRead, openConversation])

  const closeMessenger = useCallback(() => {
    if (activeIdRef.current) {
      api.post(`/chat/conversations/${activeIdRef.current}/typing`, { typing: false }).catch(() => {})
    }
    if (typingIdleTimerRef.current) {
      window.clearTimeout(typingIdleTimerRef.current)
      typingIdleTimerRef.current = null
    }
    setTypingUsers([])
    setOpen(false)
  }, [])

  const pushLocalMessage = useCallback((message) => {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
    setConversations((prev) => {
      const current = prev.find((c) => c.id === message.conversation_id)
      const next = {
        ...(current || { id: message.conversation_id }),
        latest_message: message,
        last_message_at: message.created_at,
        unread_count: 0,
      }
      return [next, ...prev.filter((c) => c.id !== message.conversation_id)]
    })
  }, [])

  const sendMessage = useCallback(async (payload) => {
    if (!activeIdRef.current || sending) return null

    const options = typeof payload === 'string'
      ? { type: 'text', body: payload }
      : (payload || {})

    const type = options.type || 'text'
    const body = String(options.body || '').trim()
    const file = options.file || null
    const stickerId = options.stickerId || null
    const stickerUrl = options.stickerUrl || null
    const gifUrl = options.gifUrl || null
    const gifId = options.gifId || null
    const durationMs = options.durationMs || null
    const replyToMessageId = options.replyToMessageId || null

    if (type === 'text' && !body) return null
    if (type === 'gif' && !gifUrl) return null
    if (type === 'sticker' && !stickerUrl && !body && !stickerId) return null
    if (['image', 'file', 'voice'].includes(type) && !file) return null

    setSending(true)
    try {
      let data
      if (file) {
        const form = new FormData()
        form.append('type', type)
        if (body) form.append('body', body)
        if (durationMs) form.append('duration_ms', String(durationMs))
        if (stickerId) form.append('sticker_id', stickerId)
        if (replyToMessageId) form.append('reply_to_message_id', String(replyToMessageId))
        form.append('attachment', file)
        ;({ data } = await api.upload(`/chat/conversations/${activeIdRef.current}/messages`, form))
      } else {
        ;({ data } = await api.post(`/chat/conversations/${activeIdRef.current}/messages`, {
          type,
          body,
          reply_to_message_id: replyToMessageId || undefined,
          sticker_id: stickerId || undefined,
          sticker_url: stickerUrl || undefined,
          gif_url: gifUrl || undefined,
          gif_id: gifId || undefined,
        }))
      }
      const message = data.message
      pushLocalMessage(message)
      return message
    } catch (err) {
      setError(err?.message || 'Could not send message.')
      throw err
    } finally {
      setSending(false)
    }
  }, [sending, pushLocalMessage])

  const editMessage = useCallback(async (messageId, body) => {
    const conversationId = activeIdRef.current
    const text = String(body || '').trim()
    if (!conversationId || !messageId || !text) return null
    setError('')
    try {
      const { data } = await api.put(
        `/chat/conversations/${conversationId}/messages/${messageId}`,
        { body: text },
      )
      const message = data.message
      if (!message?.id) return null
      setMessages((prev) => prev.map((row) => (Number(row.id) === Number(message.id) ? { ...row, ...message } : row)))
      setConversations((prev) =>
        prev.map((row) => {
          if (Number(row.id) !== Number(message.conversation_id)) return row
          if (Number(row.latest_message?.id) !== Number(message.id)) return row
          return { ...row, latest_message: { ...row.latest_message, ...message } }
        }),
      )
      return message
    } catch (err) {
      setError(err?.message || 'Could not edit message.')
      throw err
    }
  }, [])

  const applyMessageUpdate = useCallback((payload) => {
    const message = payload?.message
    if (!message?.id) return
    setMessages((prev) => prev.map((row) => (Number(row.id) === Number(message.id) ? { ...row, ...message } : row)))
    setConversations((prev) =>
      prev.map((row) => {
        if (Number(row.id) !== Number(message.conversation_id)) return row
        if (Number(row.latest_message?.id) !== Number(message.id)) return row
        return { ...row, latest_message: { ...row.latest_message, ...message } }
      }),
    )
  }, [])

  const applyTypingState = useCallback((payload) => {
    const userId = Number(payload?.user_id || 0)
    const name = String(payload?.name || '').trim()
    const typing = !!payload?.typing
    const conversationId = Number(payload?.conversation_id || activeIdRef.current || 0)
    if (!userId || userId === user?.id) return
    if (conversationId && activeIdRef.current && conversationId !== activeIdRef.current) return

    setTypingUsers((prev) => {
      const without = prev.filter((row) => row.userId !== userId)
      if (!typing || !name) return without
      return [...without, { userId, name }]
    })

    const timers = typingClearTimersRef.current
    if (timers[userId]) {
      window.clearTimeout(timers[userId])
      delete timers[userId]
    }
    if (typing) {
      timers[userId] = window.setTimeout(() => {
        setTypingUsers((prev) => prev.filter((row) => row.userId !== userId))
        delete timers[userId]
      }, 3000)
    }
  }, [user?.id])

  const notifyTyping = useCallback((isTyping) => {
    const conversationId = activeIdRef.current
    if (!conversationId || !user?.id) return

    const now = Date.now()
    if (isTyping && now - lastTypingSentRef.current < 1200) {
      if (typingIdleTimerRef.current) window.clearTimeout(typingIdleTimerRef.current)
      typingIdleTimerRef.current = window.setTimeout(() => {
        notifyTyping(false)
      }, 1800)
      return
    }
    lastTypingSentRef.current = now

    if (typingIdleTimerRef.current) {
      window.clearTimeout(typingIdleTimerRef.current)
      typingIdleTimerRef.current = null
    }

    const echo = getEcho()
    const channel = echo?.private(`chat.conversation.${conversationId}`)
    try {
      channel?.whisper('typing', {
        conversation_id: conversationId,
        user_id: user.id,
        name: user.name,
        typing: !!isTyping,
      })
    } catch {
      // whisper optional
    }

    api.post(`/chat/conversations/${conversationId}/typing`, { typing: !!isTyping }).catch(() => {})

    if (isTyping) {
      typingIdleTimerRef.current = window.setTimeout(() => {
        notifyTyping(false)
      }, 1800)
    }
  }, [user?.id, user?.name])

  const applyReceipt = useCallback((payload) => {
    const ids = (payload?.message_ids || []).map(Number).filter(Boolean)
    if (!ids.length) return
    const status = payload.status === 'seen' ? 'seen' : 'delivered'
    const at = payload.at || new Date().toISOString()
    const idSet = new Set(ids)

    setMessages((prev) =>
      prev.map((row) => {
        if (!idSet.has(Number(row.id))) return row
        if (status === 'seen') {
          return {
            ...row,
            delivered_at: row.delivered_at || at,
            read_at: row.read_at || at,
            delivery_status: 'seen',
          }
        }
        if (row.read_at || row.delivery_status === 'seen') return row
        return {
          ...row,
          delivered_at: row.delivered_at || at,
          delivery_status: 'delivered',
        }
      }),
    )

    setConversations((prev) =>
      prev.map((row) => {
        const latest = row.latest_message
        if (!latest || !idSet.has(Number(latest.id))) return row
        if (status === 'seen') {
          return {
            ...row,
            latest_message: {
              ...latest,
              delivered_at: latest.delivered_at || at,
              read_at: latest.read_at || at,
              delivery_status: 'seen',
            },
          }
        }
        if (latest.read_at || latest.delivery_status === 'seen') return row
        return {
          ...row,
          latest_message: {
            ...latest,
            delivered_at: latest.delivered_at || at,
            delivery_status: 'delivered',
          },
        }
      }),
    )
  }, [])

  const handleIncomingMessage = useCallback((payload) => {
    const message = payload?.message
    if (!message?.id) return

    const messageId = Number(message.id)
    const alreadySeen = seenMessageIdsRef.current.has(messageId)
    if (!alreadySeen) {
      seenMessageIdsRef.current.add(messageId)
      if (seenMessageIdsRef.current.size > 300) {
        seenMessageIdsRef.current = new Set([...seenMessageIdsRef.current].slice(-150))
      }
    }

    if (message.sender_id) {
      setTypingUsers((prev) => prev.filter((row) => row.userId !== message.sender_id))
    }

    const viewingThis =
      openRef.current && Number(activeIdRef.current) === Number(message.conversation_id)
    const unreadBump =
      !alreadySeen &&
      message.sender_id !== user?.id &&
      !viewingThis
        ? 1
        : 0

    setConversations((prev) => {
      const existing = prev.find((c) => c.id === message.conversation_id)
      const next = {
        ...(existing || { id: message.conversation_id }),
        latest_message: message,
        last_message_at: message.created_at,
        unread_count: viewingThis
          ? 0
          : Number(existing?.unread_count || 0) + unreadBump,
        customer: existing?.customer || null,
      }
      return [next, ...prev.filter((c) => c.id !== message.conversation_id)]
    })

    if (Number(activeIdRef.current) === Number(message.conversation_id)) {
      setMessages((prev) => (prev.some((m) => Number(m.id) === messageId) ? prev : [...prev, message]))
      if (openRef.current && message.sender_id !== user?.id) {
        markRead(message.conversation_id)
      }
    }

    if (message.sender_id !== user?.id) {
      if (unreadBump) {
        setUnreadCount((n) => Number(n || 0) + 1)
      }
      api.post(`/chat/conversations/${message.conversation_id}/delivered`, {
        message_ids: [message.id],
      }).catch(() => {})
      refreshChatUnread()
      refreshUnread()
    }
  }, [user?.id, markRead, refreshChatUnread, refreshUnread])

  useEffect(() => {
    handleIncomingMessageRef.current = handleIncomingMessage
  }, [handleIncomingMessage])

  useEffect(() => {
    applyTypingStateRef.current = applyTypingState
  }, [applyTypingState])

  useEffect(() => {
    applyReceiptRef.current = applyReceipt
  }, [applyReceipt])

  useEffect(() => {
    applyMessageUpdateRef.current = applyMessageUpdate
  }, [applyMessageUpdate])

  // Keep a single Echo connection for the logged-in user. Do not tear it down when
  // message handlers change — that was killing call invite subscriptions.
  useEffect(() => {
    if (!user?.id) {
      disconnectEcho()
      setUnreadCount(0)
      setConversations([])
      setMessages([])
      setActiveId(null)
      setOpen(false)
      return undefined
    }

    const token = localStorage.getItem('token')
    connectEcho(token)
    refreshChatUnread()

    const echo = getEcho()
    const cleanups = []

    if (echo) {
      const onMessage = (payload) => handleIncomingMessageRef.current?.(payload)
      const onReceipt = (payload) => applyReceiptRef.current?.(payload)
      const onUpdated = (payload) => applyMessageUpdateRef.current?.(payload)
      if (isStaff) {
        const channel = echo.private('chat.staff')
        channel.listen('.chat.message', onMessage)
        channel.listen('.chat.receipt', onReceipt)
        channel.listen('.chat.message.updated', onUpdated)
        cleanups.push(() => {
          try {
            channel.stopListening('.chat.message', onMessage)
            channel.stopListening('.chat.receipt', onReceipt)
            channel.stopListening('.chat.message.updated', onUpdated)
          } catch {
            // ignore
          }
        })
      } else {
        const channel = echo.private(`chat.user.${user.id}`)
        channel.listen('.chat.message', onMessage)
        channel.listen('.chat.receipt', onReceipt)
        channel.listen('.chat.message.updated', onUpdated)
        cleanups.push(() => {
          try {
            channel.stopListening('.chat.message', onMessage)
            channel.stopListening('.chat.receipt', onReceipt)
            channel.stopListening('.chat.message.updated', onUpdated)
          } catch {
            // ignore
          }
        })
      }
    }

    const timer = window.setInterval(() => {
      refreshChatUnread()
    }, UNREAD_POLL_MS)

    return () => {
      window.clearInterval(timer)
      cleanups.forEach((fn) => fn())
      disconnectEcho()
    }
    // refreshChatUnread is stable enough to call on mount; omit from deps so we
    // never disconnect/reconnect Echo when unread helpers change identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isStaff])

  useEffect(() => {
    if (!activeId || !user?.id) return undefined
    const echo = getEcho()
    if (!echo) return undefined

    setTypingUsers([])
    const channelName = `chat.conversation.${activeId}`
    const channel = echo.private(channelName)
    const onMessage = (payload) => handleIncomingMessageRef.current?.(payload)
    const onTyping = (payload) => applyTypingStateRef.current?.(payload)
    const onReceipt = (payload) => applyReceiptRef.current?.(payload)
    const onUpdated = (payload) => applyMessageUpdateRef.current?.(payload)
    channel.listen('.chat.message', onMessage)
    channel.listen('.chat.typing', onTyping)
    channel.listen('.chat.receipt', onReceipt)
    channel.listen('.chat.message.updated', onUpdated)
    channel.listenForWhisper('typing', onTyping)

    return () => {
      try {
        channel.stopListening('.chat.message', onMessage)
        channel.stopListening('.chat.typing', onTyping)
        channel.stopListening('.chat.receipt', onReceipt)
        channel.stopListening('.chat.message.updated', onUpdated)
        channel.stopListeningForWhisper('typing')
      } catch {
        // ignore
      }
      Object.values(typingClearTimersRef.current).forEach((id) => window.clearTimeout(id))
      typingClearTimersRef.current = {}
      if (typingIdleTimerRef.current) {
        window.clearTimeout(typingIdleTimerRef.current)
        typingIdleTimerRef.current = null
      }
    }
  }, [activeId, user?.id])

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId],
  )

  const typingLabel = useMemo(() => {
    if (!typingUsers.length) return ''
    if (typingUsers.length === 1) return typingUsers[0].name
    return typingUsers.map((row) => row.name).join(', ')
  }, [typingUsers])

  const value = useMemo(
    () => ({
      open,
      view,
      setView,
      conversations,
      activeId,
      activeConversation,
      messages,
      unreadCount,
      loadingInbox,
      loadingThread,
      sending,
      error,
      isStaff,
      typingUsers,
      typingLabel,
      notifyTyping,
      openMessenger,
      closeMessenger,
      openConversation,
      startConversationWithCustomer,
      closeConversation,
      loadConversations,
      sendMessage,
      editMessage,
      refreshChatUnread,
    }),
    [
      open,
      view,
      conversations,
      activeId,
      activeConversation,
      messages,
      unreadCount,
      loadingInbox,
      loadingThread,
      sending,
      error,
      isStaff,
      typingUsers,
      typingLabel,
      notifyTyping,
      openMessenger,
      closeMessenger,
      openConversation,
      startConversationWithCustomer,
      closeConversation,
      loadConversations,
      sendMessage,
      editMessage,
      refreshChatUnread,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}
