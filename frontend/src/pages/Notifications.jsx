import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import Pagination from '../components/Pagination'
import { useChat } from '../context/ChatContext'
import { useLanguage } from '../context/LanguageContext'
import { useNotifications } from '../context/NotificationContext'
import api, { getErrorMessage } from '../lib/api'
import { faBell } from '../lib/icons'

export default function Notifications() {
  const { t, lang } = useLanguage()
  const { setUnreadCount, refreshUnread, markAllRead } = useNotifications()
  const { openMessenger } = useChat()
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState(null)
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  async function load(nextPage = 1, { clearOnOpen = false } = {}) {
    setLoading(true)
    try {
      const { data } = await api.get('/notifications', {
        params: { page: nextPage, per_page: 20 },
      })
      let rows = data.notifications.data || []
      let nextUnread = Number(data.unread_count || 0)

      // Opening the inbox clears unread so the header badge stays in sync.
      if (clearOnOpen && nextUnread > 0) {
        try {
          await markAllRead()
          rows = rows.map((row) => ({
            ...row,
            read_at: row.read_at || new Date().toISOString(),
          }))
          nextUnread = 0
        } catch {
          // Keep server unread counts if mark-all failed.
        }
      }

      setItems(rows)
      setMeta(data.notifications)
      setUnread(nextUnread)
      setUnreadCount(nextUnread)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1, { clearOnOpen: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onMarkAllRead() {
    setBusy(true)
    try {
      await markAllRead()
      setItems((prev) => prev.map((row) => ({ ...row, read_at: row.read_at || new Date().toISOString() })))
      setUnread(0)
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
      await refreshUnread()
    } finally {
      setBusy(false)
    }
  }

  async function markRead(item) {
    if (item.read_at) return
    try {
      const { data } = await api.post(`/notifications/${item.id}/read`)
      setItems((prev) => prev.map((row) => (row.id === item.id ? data.notification : row)))
      setUnread((n) => {
        const next = Math.max(0, n - 1)
        setUnreadCount(next)
        return next
      })
    } catch {
      // ignore single mark-read failures
    }
  }

  async function onOpenItem(item) {
    await markRead(item)
    if (item.type === 'chat_message' || item.data?.open_chat) {
      openMessenger({ conversationId: item.data?.conversation_id || null })
    }
  }

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        showBack
        title={t('notifications')}
        subtitle={t('notificationsInboxCopy')}
        icon={faBell}
        actions={
          unread > 0 ? (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={onMarkAllRead}>
              {t('markAllRead')}
            </button>
          ) : null
        }
      />

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <div className="table-wrap is-stackable">
        <table className="data" aria-label={t('notifications')}>
          <thead>
            <tr>
              <th scope="col">{t('date')}</th>
              <th scope="col">{t('notification')}</th>
              <th scope="col">{t('status')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} className="loading-state" role="status" aria-live="polite">
                  {t('loading')}
                </td>
              </tr>
            )}
            {!loading &&
              items.map((item) => (
                <tr
                  key={item.id}
                  className={!item.read_at ? 'is-unread' : undefined}
                  onClick={() => onOpenItem(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onOpenItem(item)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                >
                  <td data-label={t('date')}>
                    {new Date(item.created_at).toLocaleString(lang === 'my' ? 'my-MM' : 'en-GB')}
                  </td>
                  <td data-label={t('notification')}>
                    <div className="font-medium">{item.title}</div>
                    {item.body ? (
                      <div className="type-meta text-[var(--color-muted)]">{item.body}</div>
                    ) : null}
                    {(item.type === 'chat_message' || item.data?.open_chat) ? (
                      <div className="type-meta text-[var(--color-primary)] mt-1">{t('openInChat')}</div>
                    ) : null}
                  </td>
                  <td data-label={t('status')}>
                    {item.read_at ? t('notificationRead') : t('notificationUnread')}
                  </td>
                </tr>
              ))}
            {!loading && !items.length && (
              <tr>
                <td colSpan={3} className="empty-state">
                  {t('noNotifications')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} onPageChange={(page) => load(page)} />
    </div>
  )
}
