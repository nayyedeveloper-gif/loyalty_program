import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import PageHeader from '../components/PageHeader'
import ChatStartCustomerModal from '../components/ChatStartCustomerModal'
import ChatThreadRoom from '../components/ChatThreadRoom'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { useLanguage } from '../context/LanguageContext'
import api, { mediaUrl } from '../lib/api'
import { previewMessageText } from '../lib/chatMedia'
import { faChevronLeft, faComments, faMagnifyingGlass, faPlus, faXmark } from '../lib/icons'

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

export default function ChatInbox() {
  const { user } = useAuth()
  const { t, lang } = useLanguage()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    conversations,
    activeConversation,
    messages,
    unreadCount,
    loadingInbox,
    loadingThread,
    sending,
    error,
    isStaff,
    openConversation,
    startConversationWithCustomer,
    closeConversation,
    loadConversations,
    sendMessage,
    editMessage,
    deleteMessage,
    typingLabel,
    notifyTyping,
    closeMessenger,
    openMessenger,
    setView,
  } = useChat()

  const [bootError, setBootError] = useState('')
  const [staffMode, setStaffMode] = useState('list') // list | thread
  const [startOpen, setStartOpen] = useState(false)
  const [inboxSearch, setInboxSearch] = useState('')
  const bootstrappedRef = useRef(false)
  const searchTimerRef = useRef(null)

  const inboxUnread = useMemo(() => {
    if (!isStaff) return Number(unreadCount || 0)
    const fromRows = conversations.reduce((sum, row) => sum + Number(row.unread_count || 0), 0)
    // Prefer API total; fall back to open-row sum only when API is still 0.
    return Math.max(Number(unreadCount || 0), fromRows)
  }, [conversations, isStaff, unreadCount])

  const showStaffList = isStaff && staffMode === 'list'
  const showThread = !isStaff || staffMode === 'thread'

  useEffect(() => {
    closeMessenger()
    let cancelled = false

    ;(async () => {
      if (isStaff) return

      try {
        const { data } = await api.post('/chat/conversations/open')
        if (cancelled) return
        const conversation = data.conversation
        if (!conversation?.id) return
        await loadConversations()
        await openConversation(conversation.id)
        setSearchParams({ c: String(conversation.id) }, { replace: true })
        bootstrappedRef.current = true
        setBootError('')
      } catch (err) {
        if (!cancelled) {
          setBootError(err?.message || t('somethingWrong'))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [closeMessenger, isStaff, loadConversations, openConversation, setSearchParams, t])

  useEffect(() => {
    if (!isStaff) return
    const requested = Number(searchParams.get('c') || 0)
    if (!requested) {
      setStaffMode('list')
      return
    }
    if (!conversations.some((row) => Number(row.id) === requested)) return
    bootstrappedRef.current = true
    setStaffMode('thread')
    if (Number(activeConversation?.id) !== requested) {
      openConversation(requested)
    }
  }, [activeConversation?.id, conversations, isStaff, openConversation, searchParams])

  useEffect(() => {
    if (!isStaff || !showStaffList) return undefined
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
    searchTimerRef.current = window.setTimeout(() => {
      loadConversations({ search: inboxSearch })
    }, 280)
    return () => {
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
    }
  }, [inboxSearch, isStaff, loadConversations, showStaffList])

  async function selectConversation(row) {
    const customerId = row.customer_id || row.customer?.id
    let conversationId = row.id
    if (row.status === 'closed' && customerId) {
      const conversation = await startConversationWithCustomer(customerId)
      if (!conversation?.id) return
      conversationId = conversation.id
    } else {
      await openConversation(conversationId)
    }
    setInboxSearch('')
    setStaffMode('thread')
    setSearchParams({ c: String(conversationId) }, { replace: true })
  }

  function backToStaffList() {
    setStaffMode('list')
    setView('inbox')
    setSearchParams({}, { replace: true })
  }

  function leaveCustomerChat() {
    closeMessenger()
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/app')
  }

  async function handleStartedWithCustomer(customerId) {
    const conversation = await startConversationWithCustomer(customerId)
    if (!conversation?.id) return null
    setStaffMode('thread')
    setSearchParams({ c: String(conversation.id) }, { replace: true })
    return conversation
  }

  async function handleCloseConversation(conversationId) {
    await closeConversation(conversationId)
    if (Number(searchParams.get('c') || 0) === Number(conversationId)) {
      setStaffMode('list')
      setSearchParams({}, { replace: true })
    }
  }

  const threadTitle = isStaff
    ? (activeConversation?.customer?.name || t('chatSelectConversation'))
    : t('chatSupportTitle')
  const threadSubtitle = isStaff
    ? (activeConversation?.customer?.customer_code || t('chatSupportSubtitle'))
    : t('chatSupportSubtitle')

  return (
    <div className={`chat-inbox-page${showStaffList ? ' is-list-focus' : ' is-thread-focus'}`}>
      {showStaffList ? (
        <PageHeader
          title={t('chatInboxTitle')}
          subtitle={t('chatSupportSubtitle')}
          icon={faComments}
          actions={
            inboxUnread > 0 ? (
              <span className="chat-inbox-page-live" aria-label={t('chatUnread', { count: inboxUnread })}>
                {inboxUnread > 99 ? '99+' : inboxUnread}
              </span>
            ) : null
          }
        />
      ) : null}

      {error || bootError ? <div className="banner error">{error || bootError}</div> : null}

      <div className={`chat-inbox-workspace is-stacked${showStaffList ? ' is-list' : ' is-thread'}`}>
        {showStaffList ? (
          <aside className="chat-inbox-rail is-full">
            <div className="chat-inbox-rail-head">
              <span>{t('chatInboxTitle')}</span>
              {inboxUnread > 0 ? (
                <span className="chat-sidebar-live">{inboxUnread > 99 ? '99+' : inboxUnread}</span>
              ) : null}
            </div>
            <div className="chat-inbox-search">
              <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
              <label className="sr-only" htmlFor="chat-inbox-search">
                {t('chatSearchConversations')}
              </label>
              <input
                id="chat-inbox-search"
                type="search"
                value={inboxSearch}
                onChange={(e) => setInboxSearch(e.target.value)}
                placeholder={t('chatSearchConversations')}
                autoComplete="off"
              />
            </div>
            <div className="chat-inbox">
              {loadingInbox ? <div className="chat-empty">{t('loading')}</div> : null}
              {!loadingInbox && conversations.length === 0 ? (
                <div className="chat-empty">
                  {inboxSearch.trim() ? t('chatNoSearchResults') : t('chatNoConversations')}
                </div>
              ) : null}
              {conversations.map((row) => {
                const active = Number(activeConversation?.id) === Number(row.id)
                const closed = row.status === 'closed'
                return (
                  <div
                    key={row.id}
                    className={`chat-inbox-row${active ? ' is-active' : ''}${closed ? ' is-closed' : ''}`}
                  >
                    <button
                      type="button"
                      className="chat-inbox-row-main"
                      onClick={() => selectConversation(row)}
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
                          {closed ? t('chatClosedConversation') : previewMessageText(row.latest_message, t('chatNoMessagesYet'))}
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
                          handleCloseConversation(row.id)
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
          </aside>
        ) : null}

        {isStaff && showStaffList ? (
          <button
            type="button"
            className="chat-start-fab"
            onClick={() => setStartOpen(true)}
            aria-label={t('chatStartWithCustomer')}
            title={t('chatStartWithCustomer')}
          >
            <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
          </button>
        ) : null}

        {showThread ? (
          <section className="chat-inbox-thread-pane is-full">
            <ChatThreadRoom
              user={user}
              isStaff={isStaff}
              activeConversation={activeConversation}
              messages={messages}
              loadingThread={loadingThread}
              sending={sending}
              typingLabel={typingLabel}
              sendMessage={sendMessage}
              editMessage={editMessage}
              deleteMessage={deleteMessage}
              notifyTyping={notifyTyping}
              title={threadTitle}
              subtitle={threadSubtitle}
              headerLeading={
                isStaff ? (
                  <button
                    type="button"
                    className="chat-icon-btn"
                    onClick={backToStaffList}
                    aria-label={t('chatBackToInbox')}
                    title={t('chatBackToInbox')}
                  >
                    <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="chat-icon-btn"
                    onClick={leaveCustomerChat}
                    aria-label={t('chatClosePage')}
                    title={t('chatClosePage')}
                  >
                    <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                  </button>
                )
              }
              t={t}
              lang={lang}
            />
          </section>
        ) : null}
      </div>

      {isStaff ? (
        <ChatStartCustomerModal
          open={startOpen}
          onClose={() => setStartOpen(false)}
          onStarted={handleStartedWithCustomer}
          t={t}
        />
      ) : null}
    </div>
  )
}
