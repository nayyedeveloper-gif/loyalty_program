import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { getErrorMessage } from '../../../../lib/api'
import { mediaUrl } from '../../lib/media'
import BrandMark from '../../components/BrandMark'
import SpinWheel from '../../components/SpinWheel'
import { ConfirmDialog } from '../../components/ui'
import '../../styles/spinwheel.css'

const MAX_LOGO_BYTES = 4 * 1024 * 1024

function pickPreferredWheel(list) {
  if (!list?.length) return null
  const published = list.find((w) => w.status === 'published')
  return published || list[0]
}

export default function AdminSpinWheel() {
  const [wheels, setWheels] = useState([])
  const [wheel, setWheel] = useState(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const fileInputRef = useRef(null)
  const objectUrlRef = useRef(null)

  const revokeObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }

  useEffect(() => () => revokeObjectUrl(), [])

  const applyWheel = (next) => {
    setWheel(next)
    const url = mediaUrl(next.logo_url || next.logo_path)
    setLogoPreview(url || null)
    setLogoFile(null)
    setRemoveLogo(false)
    revokeObjectUrl()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const load = useCallback(async () => {
    const { data } = await api.get('/spinwheel/admin/wheels')
    const list = data || []
    setWheels(list)
    const preferred = pickPreferredWheel(list)
    if (preferred) {
      const { data: full } = await api.get(`/spinwheel/admin/wheels/${preferred.id}`)
      applyWheel(full)
    } else {
      setWheel(null)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    load()
      .catch((err) => setError(getErrorMessage(err, 'Unable to load wheel')))
      .finally(() => setLoading(false))
  }, [load])

  const selectWheel = async (id) => {
    setBusy(true)
    setError('')
    try {
      const { data } = await api.get(`/spinwheel/admin/wheels/${id}`)
      applyWheel(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load wheel'))
    } finally {
      setBusy(false)
    }
  }

  const onLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file for the logo.')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('Logo must be 4 MB or smaller.')
      return
    }
    setError('')
    revokeObjectUrl()
    const preview = URL.createObjectURL(file)
    objectUrlRef.current = preview
    setLogoFile(file)
    setLogoPreview(preview)
    setRemoveLogo(false)
  }

  const clearLogo = () => {
    const hadStored = !!(wheel?.logo_url || wheel?.logo_path) && !logoFile
    revokeObjectUrl()
    setLogoFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (hadStored) {
      setRemoveLogo(true)
      setLogoPreview(null)
      return
    }
    setRemoveLogo(false)
    setLogoPreview(mediaUrl(wheel?.logo_url || wheel?.logo_path) || null)
  }

  const saveWheel = async () => {
    if (!wheel) return
    setBusy(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('name', wheel.name || '')
      fd.append('page_title', wheel.page_title || '')
      fd.append('brand_title', wheel.brand_title || '')
      fd.append('description', wheel.description || '')
      fd.append('help_text', wheel.help_text || '')
      fd.append('status', wheel.status || 'draft')
      if (logoFile) fd.append('logo', logoFile)
      else if (removeLogo) fd.append('remove_logo', '1')

      const { data: updated } = await api.upload(`/spinwheel/admin/wheels/${wheel.id}`, fd)
      applyWheel(updated)
      setMsg('Wheel saved')
      const { data: list } = await api.get('/spinwheel/admin/wheels')
      setWheels(list || [])
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to save wheel'))
    } finally {
      setBusy(false)
    }
  }

  const moveSegment = async (segment, direction) => {
    if (!wheel) return
    const order = (wheel.segments || []).map((s) => s.id)
    const idx = order.indexOf(segment.id)
    const swapWith = idx + direction
    if (swapWith < 0 || swapWith >= order.length) return
    ;[order[idx], order[swapWith]] = [order[swapWith], order[idx]]
    setBusy(true)
    try {
      const { data: updated } = await api.post(`/spinwheel/admin/wheels/${wheel.id}/reorder`, { order })
      setWheel(updated)
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to reorder prizes'))
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (segment) => {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('is_active', segment.is_active ? '0' : '1')
      await api.upload(`/spinwheel/admin/segments/${segment.id}`, fd)
      await load()
      setMsg(segment.is_active ? 'Prize deactivated' : 'Prize activated')
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update prize'))
    } finally {
      setBusy(false)
    }
  }

  const removeSegment = async (segment) => {
    if (!segment) return
    setBusy(true)
    try {
      await api.delete(`/spinwheel/admin/segments/${segment.id}`)
      setConfirmDelete(null)
      await load()
      setMsg('Prize deleted')
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to delete prize'))
    } finally {
      setBusy(false)
    }
  }

  const totalWeight = wheel?.segments?.filter((s) => s.is_active).reduce((a, s) => a + Number(s.weight), 0) || 0
  const previewSegments = wheel?.segments?.filter((s) => s.is_active) || []
  const outOfStock = wheel?.segments?.filter((s) => s.stock !== null && s.stock !== undefined && Number(s.stock) <= 0) || []

  const createWheel = async () => {
    setBusy(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('name', 'Loyalty Rewards Wheel')
      fd.append('page_title', 'Spin & Win')
      fd.append('brand_title', '29 Jewellery')
      fd.append('status', 'published')
      fd.append('help_text', '1) Confirm your spin.\n2) The wheel stops on the prize selected by the server.\n3) Show your reward code to staff for collection.')
      const { data } = await api.upload('/spinwheel/admin/wheels', fd)
      applyWheel(data)
      setWheels([data])
      setMsg('Wheel created')
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create wheel'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="admin-body spinwheel-admin">
        <div className="admin-card">Loading wheel…</div>
      </div>
    )
  }

  if (!wheel) {
    return (
      <div className="admin-body spinwheel-admin">
        {(msg || error) && <div className={`admin-flash ${error ? 'err' : 'ok'}`}>{error || msg}</div>}
        <div className="admin-card">
          <h2 style={{ marginTop: 0 }}>No wheel yet</h2>
          <p className="admin-muted">Create the loyalty spinwheel campaign to configure branding and prizes.</p>
          <button type="button" className="admin-btn admin-btn-primary" onClick={createWheel} disabled={busy}>
            {busy ? 'Creating…' : 'Create wheel'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-body spinwheel-admin">
      {(msg || error) && <div className={`admin-flash ${error ? 'err' : 'ok'}`}>{error || msg}</div>}
      {!!outOfStock.length && (
        <div className="admin-flash err">
          {outOfStock.length} prize{outOfStock.length === 1 ? '' : 's'} out of stock and removed from the live wheel:
          {' '}
          {outOfStock.map((s) => s.prize_label).join(', ')}. Restock and save to reactivate.
        </div>
      )}

      {wheels.length > 1 && (
        <div className="admin-card" style={{ marginBottom: '1rem' }}>
          <label className="admin-label">Select wheel</label>
          <select
            className="admin-select"
            value={wheel.id}
            onChange={(e) => selectWheel(e.target.value)}
            disabled={busy}
          >
            {wheels.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} · {w.status}
              </option>
            ))}
          </select>
        </div>
      )}

      <section className="admin-grid">
        <div className="admin-card">
          <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem' }}>Branding</h2>
          <p className="admin-muted" style={{ marginTop: 0 }}>
            Header logo and title shown on customer and guest pages.
          </p>
          <label className="admin-label">Brand title</label>
          <input
            className="admin-input"
            value={wheel.brand_title || ''}
            onChange={(e) => setWheel({ ...wheel, brand_title: e.target.value })}
            placeholder="Shown in the site header"
          />
          <label className="admin-label">Logo</label>
          <div className="image-picker">
            <div className="image-picker-preview">
              {logoPreview ? (
                <img src={logoPreview} alt="" />
              ) : (
                <span className="image-picker-empty">
                  {(wheel.brand_title || 'SW').trim().slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="image-picker-actions">
              <input
                ref={fileInputRef}
                id="brand-logo-input"
                className="image-picker-input"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                onChange={onLogoChange}
              />
              <label htmlFor="brand-logo-input" className="admin-btn admin-btn-primary image-picker-choose">
                {logoPreview ? 'Change logo' : 'Choose logo'}
              </label>
              {logoPreview && (
                <button type="button" className="admin-btn admin-btn-danger" onClick={clearLogo} disabled={busy}>
                  Remove
                </button>
              )}
              <p className="admin-muted" style={{ margin: '0.35rem 0 0' }}>
                PNG, JPG, WebP, GIF, or SVG · max 4 MB
                {removeLogo && !logoFile ? ' · will clear on save' : ''}
              </p>
            </div>
          </div>
          <div
            style={{
              marginTop: 14,
              padding: '0.85rem 1rem',
              borderRadius: 12,
              background: 'linear-gradient(180deg, var(--color-surface), var(--color-surface-2))',
              color: 'var(--cx-text)',
              border: '1px solid var(--color-line)',
            }}
          >
            <p className="admin-muted" style={{ margin: '0 0 0.55rem' }}>Header preview</p>
            <BrandMark
              title={wheel.brand_title}
              logoUrl={logoPreview}
              subtitle="Preview subtitle"
            />
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--admin-border)', margin: '1.2rem 0' }} />

          <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem' }}>Wheel configuration</h2>
          <label className="admin-label">Internal name</label>
          <input className="admin-input" value={wheel.name || ''} onChange={(e) => setWheel({ ...wheel, name: e.target.value })} />
          <label className="admin-label">Customer page title</label>
          <input
            className="admin-input"
            value={wheel.page_title || ''}
            onChange={(e) => setWheel({ ...wheel, page_title: e.target.value })}
            placeholder="Shown above the spin wheel"
          />
          <label className="admin-label">Help popup text (? icon)</label>
          <textarea
            className="admin-textarea"
            value={wheel.help_text || ''}
            onChange={(e) => setWheel({ ...wheel, help_text: e.target.value })}
            placeholder="Shown when customers tap the ? icon"
            rows={5}
          />
          <label className="admin-label">Internal description</label>
          <textarea className="admin-textarea" value={wheel.description || ''} onChange={(e) => setWheel({ ...wheel, description: e.target.value })} />
          <label className="admin-label">Status</label>
          <select className="admin-select" value={wheel.status || 'draft'} onChange={(e) => setWheel({ ...wheel, status: e.target.value })}>
            {['draft', 'published', 'paused', 'archived'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="button" className="admin-btn admin-btn-primary" style={{ marginTop: 12 }} disabled={busy} onClick={saveWheel}>
            Save wheel
          </button>

          <hr style={{ border: 0, borderTop: '1px solid var(--admin-border)', margin: '1.2rem 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Prizes</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="admin-muted">Total weight {totalWeight}</span>
              <Link className="admin-btn admin-btn-primary" to={`/admin/spinwheel/prizes/new?wheelId=${wheel.id}`}>
                Add Prize
              </Link>
            </div>
          </div>

          {wheel.segments?.map((s) => (
            <div key={s.id} className="seg-row">
              <div className="seg-row-head">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {mediaUrl(s.image_url || s.image_path)
                    ? <img className="seg-thumb" src={mediaUrl(s.image_url || s.image_path)} alt="" />
                    : <div className="seg-thumb" />}
                  <div>
                    <strong>{s.prize_label}</strong>
                    <div className="admin-muted">
                      {s.display_label} · weight {s.weight}
                      {totalWeight ? ` (${Math.round((s.weight / totalWeight) * 100)}%)` : ''} · {s.tier}
                      {s.stock === null || s.stock === undefined
                        ? ' · unlimited stock'
                        : ` · stock ${s.stock}${s.stock <= 0 ? ' · OUT' : ''}`}
                      {!s.is_active ? ' · inactive' : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="admin-btn" onClick={() => moveSegment(s, -1)}>Up</button>
                  <button type="button" className="admin-btn" onClick={() => moveSegment(s, 1)}>Down</button>
                  <Link className="admin-btn" to={`/admin/spinwheel/prizes/${s.id}`}>Edit</Link>
                  <button type="button" className="admin-btn" disabled={busy} onClick={() => toggleActive(s)}>
                    {s.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button type="button" className="admin-btn admin-btn-danger" onClick={() => setConfirmDelete(s)}>Delete</button>
                </div>
              </div>
              <div className="admin-muted">
                Collection: {s.requires_claim ? (s.claim_days ? `${s.claim_days} day(s)` : 'required, no deadline') : 'not required'}
              </div>
            </div>
          ))}
        </div>

        <div className="admin-card admin-preview">
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>Customer preview</h2>
          <div className="spinwheel-preview-panel" style={{ borderRadius: 12, padding: '1rem 0.5rem 1.25rem', background: 'linear-gradient(180deg, var(--color-surface), var(--color-surface-2))', border: '1px solid var(--color-line)' }}>
            <SpinWheel segments={previewSegments} idle />
          </div>
          <p className="admin-muted" style={{ marginTop: '0.75rem' }}>
            Version {wheel.version} · {wheel.status} · {previewSegments.length} active prizes
          </p>
        </div>
      </section>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete prize?"
        body={confirmDelete ? `Remove “${confirmDelete.prize_label}”. Existing won rewards keep their historical snapshot.` : ''}
        confirmLabel="Delete prize"
        danger
        busy={busy}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => removeSegment(confirmDelete)}
      />
    </div>
  )
}
