import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import Pagination from '../../components/Pagination'
import { useLanguage } from '../../context/LanguageContext'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import api, { getErrorMessage } from '../../lib/api'
import { faCircleQuestion, faFloppyDisk, faPenToSquare, faPlus, faTrash, faXmark } from '../../lib/icons'

const emptyForm = {
  question_en: '',
  question_my: '',
  answer_en: '',
  answer_my: '',
  sort_order: '',
  is_active: true,
}

export default function AdminFaqs() {
  const { t, lang } = useLanguage()
  const [faqs, setFaqs] = useState([])
  const [meta, setMeta] = useState(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function load(nextPage = 1, query = debouncedSearch) {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/faqs', {
        params: {
          search: query || undefined,
          page: nextPage,
          per_page: 50,
        },
      })
      setFaqs(data.faqs.data || [])
      setMeta(data.faqs)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, t('somethingWrong')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1, debouncedSearch)
  }, [debouncedSearch])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setMessage('')
    setModalOpen(true)
  }

  function openEdit(faq) {
    setEditing(faq)
    setForm({
      question_en: faq.question_en || '',
      question_my: faq.question_my || '',
      answer_en: faq.answer_en || '',
      answer_my: faq.answer_my || '',
      sort_order: faq.sort_order == null ? '' : String(faq.sort_order),
      is_active: !!faq.is_active,
    })
    setError('')
    setMessage('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
  }

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    const payload = {
      question_en: form.question_en,
      question_my: form.question_my || null,
      answer_en: form.answer_en,
      answer_my: form.answer_my || null,
      sort_order: form.sort_order === '' ? null : Number(form.sort_order),
      is_active: !!form.is_active,
    }
    try {
      if (editing) {
        await api.put(`/admin/faqs/${editing.id}`, payload)
        setMessage(t('faqUpdated'))
      } else {
        await api.post('/admin/faqs', payload)
        setMessage(t('faqCreated'))
      }
      setModalOpen(false)
      await load(meta?.current_page || 1)
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotSaveFaq')))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setError('')
    try {
      await api.delete(`/admin/faqs/${deleteTarget.id}`)
      setMessage(t('faqDeleted'))
      setDeleteTarget(null)
      await load(meta?.current_page || 1)
    } catch (err) {
      setError(getErrorMessage(err, t('couldNotDeleteFaq')))
    } finally {
      setDeleting(false)
    }
  }

  function displayQuestion(faq) {
    if (lang === 'my') return faq.question_my || faq.question_en
    return faq.question_en
  }

  function displayAnswer(faq) {
    if (lang === 'my') return faq.answer_my || faq.answer_en
    return faq.answer_en
  }

  return (
    <div className="space-y-5">
      <PageHeader
        showBack
        title={t('manageFaqs')}
        subtitle={t('manageFaqsCopy')}
        icon={faCircleQuestion}
        actions={(
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
            {t('addFaq')}
          </button>
        )}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-ok" role="status">{message}</div>}

      <form
        className="filter-bar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          load(1, search.trim())
        }}
      >
        <label className="sr-only" htmlFor="faq-search">{t('search')}</label>
        <input
          id="faq-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchFaqsPlaceholder')}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-ghost">
          {t('search')}
        </button>
      </form>

      <div className="table-wrap is-stackable">
        <table className="data" aria-label={t('manageFaqs')}>
          <thead>
            <tr>
              <th scope="col">{t('order')}</th>
              <th scope="col">{t('question')}</th>
              <th scope="col">{t('status')}</th>
              <th scope="col">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="loading-state" role="status" aria-live="polite">
                  {t('loading')}
                </td>
              </tr>
            )}
            {!loading &&
              faqs.map((faq) => (
                <tr key={faq.id}>
                  <td data-label={t('order')}>{faq.sort_order}</td>
                  <td data-label={t('question')}>
                    <div className="font-medium">{displayQuestion(faq)}</div>
                    <div className="type-meta text-[var(--color-muted)] line-clamp-2">{displayAnswer(faq)}</div>
                  </td>
                  <td data-label={t('status')}>{faq.is_active ? t('active') : t('inactive')}</td>
                  <td data-label={t('actions')}>
                    <div className="action-row">
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon-action"
                        onClick={() => openEdit(faq)}
                        aria-label={t('edit')}
                      >
                        <FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" />
                        <span className="btn-tooltip">{t('edit')}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-icon-action"
                        onClick={() => setDeleteTarget(faq)}
                        aria-label={t('delete')}
                      >
                        <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                        <span className="btn-tooltip">{t('delete')}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && !faqs.length && (
              <tr>
                <td colSpan={4} className="empty-state">{t('noFaqsFound')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} onPageChange={load} />

      <ConfirmModal
        open={!!deleteTarget}
        title={t('confirmDeleteTitle')}
        message={t('deleteFaqConfirm', {
          question:
            (lang === 'my'
              ? deleteTarget?.question_my || deleteTarget?.question_en
              : deleteTarget?.question_en) || '',
        })}
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <Modal open={modalOpen} onClose={closeModal} title={editing ? t('editFaq') : t('addFaq')}>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="field">
            <label htmlFor="faq-question-en">{t('questionEn')}</label>
            <input
              id="faq-question-en"
              required
              maxLength={255}
              value={form.question_en}
              onChange={(e) => setForm({ ...form, question_en: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="faq-answer-en">{t('answerEn')}</label>
            <textarea
              id="faq-answer-en"
              rows={4}
              required
              maxLength={5000}
              value={form.answer_en}
              onChange={(e) => setForm({ ...form, answer_en: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="faq-question-my">{t('questionMy')}</label>
            <input
              id="faq-question-my"
              maxLength={255}
              value={form.question_my}
              onChange={(e) => setForm({ ...form, question_my: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="faq-answer-my">{t('answerMy')}</label>
            <textarea
              id="faq-answer-my"
              rows={4}
              maxLength={5000}
              value={form.answer_my}
              onChange={(e) => setForm({ ...form, answer_my: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="faq-sort">{t('order')}</label>
            <input
              id="faq-sort"
              type="number"
              min={0}
              max={9999}
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              placeholder={t('orderAuto')}
            />
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={!!form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <span>
              <strong>{t('active')}</strong>
              <small>{t('faqActiveCopy')}</small>
            </span>
          </label>
          <div className="action-row">
            <button type="button" className="btn btn-ghost" onClick={closeModal}>
              <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
              {t('cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
              {busy ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
