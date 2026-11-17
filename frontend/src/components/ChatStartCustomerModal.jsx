import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Modal from './Modal'
import api, { mediaUrl } from '../lib/api'
import { faMagnifyingGlass } from '../lib/icons'

const PAGE_SIZE = 50

export default function ChatStartCustomerModal({ open, onClose, onStarted, t }) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [startingId, setStartingId] = useState(null)
  const [error, setError] = useState('')
  const debounceRef = useRef(null)
  const requestIdRef = useRef(0)
  const listRef = useRef(null)
  const queryRef = useRef('')

  async function fetchCustomers({ search = '', page: nextPage = 1, append = false } = {}) {
    const requestId = ++requestIdRef.current
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/admin/customers', {
        params: {
          search: search.trim(),
          per_page: PAGE_SIZE,
          page: nextPage,
        },
      })
      if (requestId !== requestIdRef.current) return
      const pager = data.customers || {}
      const nextRows = pager.data || []
      setRows((prev) => (append ? [...prev, ...nextRows] : nextRows))
      setPage(Number(pager.current_page || nextPage))
      setLastPage(Number(pager.last_page || 1))
      setTotal(Number(pager.total || nextRows.length))
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      if (!append) setRows([])
      setError(err?.message || t('somethingWrong'))
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }

  useEffect(() => {
    if (!open) {
      setQuery('')
      queryRef.current = ''
      setRows([])
      setPage(1)
      setLastPage(1)
      setTotal(0)
      setError('')
      setStartingId(null)
      setLoading(false)
      setLoadingMore(false)
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      return undefined
    }

    fetchCustomers({ search: '', page: 1, append: false })
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleSearchChange(value) {
    setQuery(value)
    queryRef.current = value
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      fetchCustomers({ search: value, page: 1, append: false })
    }, 280)
  }

  function loadMore() {
    if (loading || loadingMore || page >= lastPage) return
    fetchCustomers({ search: queryRef.current, page: page + 1, append: true })
  }

  function onListScroll(e) {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 80) return
    loadMore()
  }

  async function selectCustomer(customer) {
    if (!customer?.id || startingId) return
    setStartingId(customer.id)
    setError('')
    try {
      const conversation = await onStarted(customer.id)
      if (conversation) onClose()
    } catch (err) {
      setError(err?.message || t('somethingWrong'))
    } finally {
      setStartingId(null)
    }
  }

  const hasMore = page < lastPage

  return (
    <Modal open={open} title={t('chatStartWithCustomer')} onClose={onClose} wide>
      <div className="chat-start-customer">
        <label className="sr-only" htmlFor="chat-start-customer-search">
          {t('searchCustomersPlaceholder')}
        </label>
        <div className="chat-start-customer-search">
          <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
          <input
            id="chat-start-customer-search"
            type="search"
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('searchCustomersPlaceholder')}
            autoComplete="off"
            data-autofocus
          />
        </div>

        {!loading && total > 0 ? (
          <div className="chat-start-customer-meta">
            {t('chatCustomersShowing', { shown: rows.length, total })}
          </div>
        ) : null}

        {error ? <div className="banner error">{error}</div> : null}

        <div
          ref={listRef}
          className="chat-start-customer-list"
          role="listbox"
          aria-label={t('customers')}
          onScroll={onListScroll}
        >
          {loading ? <div className="chat-empty">{t('loading')}</div> : null}
          {!loading && rows.length === 0 ? (
            <div className="chat-empty">{t('noCustomers')}</div>
          ) : null}
          {rows.map((customer) => {
            const busy = Number(startingId) === Number(customer.id)
            return (
              <button
                key={customer.id}
                type="button"
                role="option"
                className="chat-start-customer-row"
                onClick={() => selectCustomer(customer)}
                disabled={!!startingId}
                aria-selected={busy}
              >
                <div className="chat-avatar" aria-hidden="true">
                  {customer.avatar_url ? (
                    <img src={mediaUrl(customer.avatar_url)} alt="" />
                  ) : (
                    (customer.name || '?').slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="chat-start-customer-copy min-w-0">
                  <strong className="truncate">{customer.name}</strong>
                  <span className="truncate">
                    {[customer.customer_code, customer.phone || customer.email]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <span className="chat-start-customer-action">
                  {busy ? t('loading') : t('chatStartChat')}
                </span>
              </button>
            )
          })}
          {hasMore && !loading ? (
            <button
              type="button"
              className="chat-start-customer-more"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? t('loading') : t('chatLoadMoreCustomers')}
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
