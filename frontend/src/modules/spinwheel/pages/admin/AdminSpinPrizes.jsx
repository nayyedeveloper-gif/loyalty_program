import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api, { getErrorMessage } from '../../../../lib/api'
import { mediaUrl } from '../../lib/media'
import SpinWheel from '../../components/SpinWheel'
import '../../styles/spinwheel.css'

const blank = {
  name: '',
  prize_label: '',
  display_label: '',
  description: '',
  weight: 10,
  winning_message: 'Congratulations! You won [Prize].',
  instructions: 'Show this reward reference to staff.',
  color: '#c9a227',
  tier: 'minor',
  requires_claim: true,
  claim_days: 7,
  is_active: true,
  stock: '',
  stock_unlimited: true,
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024

export default function AdminSpinPrizes() {
  const { id: routeId } = useParams()
  const [params] = useSearchParams()
  // Only numeric ids are edits. "new", missing, or junk (e.g. "undefined") = create.
  const segmentId = routeId && /^\d+$/.test(String(routeId)) ? String(routeId) : null
  const isNew = !segmentId
  const navigate = useNavigate()
  const [form, setForm] = useState(blank)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [storedImageUrl, setStoredImageUrl] = useState(null)
  const [removeStored, setRemoveStored] = useState(false)
  const [wheelId, setWheelId] = useState(params.get('wheelId') || params.get('wheel_id'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [dirty, setDirty] = useState(false)
  const fileInputRef = useRef(null)
  const objectUrlRef = useRef(null)

  const revokeObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }

  useEffect(() => () => revokeObjectUrl(), [])

  // Recover from bad URLs like /prizes/undefined left by older builds
  useEffect(() => {
    if (!routeId || routeId === 'new' || segmentId) return
    const qs = params.toString()
    navigate(`/admin/spinwheel/prizes/new${qs ? `?${qs}` : ''}`, { replace: true })
  }, [routeId, segmentId, params, navigate])

  useEffect(() => {
    if (!isNew || wheelId) return
    api.get('/spinwheel/admin/wheels')
      .then(({ data }) => {
        const list = data || []
        const preferred = list.find((w) => w.status === 'published') || list[0]
        setWheelId(preferred?.id ? String(preferred.id) : null)
      })
      .catch((err) => setError(getErrorMessage(err, 'Unable to load wheels')))
  }, [isNew, wheelId])

  useEffect(() => {
    if (!segmentId) return undefined
    let cancelled = false
    api.get(`/spinwheel/admin/segments/${segmentId}`)
      .then(({ data: segment }) => {
        if (cancelled) return
        const url = mediaUrl(segment.image_url || segment.image_path)
        setForm({
          name: segment.name || '',
          prize_label: segment.prize_label || '',
          display_label: segment.display_label || '',
          description: segment.description || '',
          weight: segment.weight ?? 10,
          winning_message: segment.winning_message || '',
          instructions: segment.instructions || '',
          color: segment.color || '#c9a227',
          tier: segment.tier || 'minor',
          requires_claim: !!segment.requires_claim,
          claim_days: segment.claim_days ?? '',
          is_active: segment.is_active !== false,
          stock: segment.stock === null || segment.stock === undefined ? '' : segment.stock,
          stock_unlimited: segment.stock === null || segment.stock === undefined,
          image_url: url,
        })
        setWheelId(String(segment.wheel_id))
        setStoredImageUrl(url || null)
        setImagePreview(url || null)
        setImageFile(null)
        setRemoveStored(false)
        setDirty(false)
        revokeObjectUrl()
        if (fileInputRef.current) fileInputRef.current.value = ''
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Unable to load prize'))
      })
    return () => { cancelled = true }
  }, [segmentId])

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const patch = (next) => {
    setForm((f) => ({ ...f, ...next }))
    setDirty(true)
  }

  const applyPickedFile = (file) => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG, WebP, GIF, or SVG).')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image must be 4 MB or smaller.')
      return
    }
    setError('')
    revokeObjectUrl()
    const preview = URL.createObjectURL(file)
    objectUrlRef.current = preview
    setImageFile(file)
    setImagePreview(preview)
    setRemoveStored(false)
    setDirty(true)
    setMsg('')
  }

  const onFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    applyPickedFile(file)
  }

  const clearImage = () => {
    revokeObjectUrl()
    setImageFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''

    if (storedImageUrl) {
      setRemoveStored(true)
      setImagePreview(null)
      setForm((f) => ({ ...f, image_url: null }))
    } else {
      setImagePreview(null)
      setRemoveStored(false)
    }
    setDirty(true)
    setMsg('')
  }

  const previewSegment = useMemo(() => [{
    id: -1,
    wheel_id: Number(wheelId) || 0,
    name: form.name || form.prize_label,
    prize_label: form.prize_label,
    display_label: form.display_label || 'LABEL',
    weight: Number(form.weight),
    winning_message: form.winning_message,
    color: form.color,
    sort_order: 0,
    is_active: true,
    requires_claim: form.requires_claim,
    tier: form.tier,
    image_url: imagePreview,
  }, {
    id: -2,
    wheel_id: Number(wheelId) || 0,
    name: 'Other',
    prize_label: 'Other',
    display_label: 'OTHER',
    weight: 1,
    winning_message: '',
    color: '#5c0a0a',
    sort_order: 1,
    is_active: true,
    requires_claim: false,
    tier: 'minor',
  }], [form, imagePreview, wheelId])

  const save = async (e) => {
    e.preventDefault()
    if (!wheelId) {
      setError('No wheel selected')
      return
    }
    setBusy(true)
    setError('')
    setMsg('')
    try {
      const fd = new FormData()
      Object.entries({
        ...form,
        name: form.name || form.prize_label,
        display_label: form.display_label || form.prize_label,
        weight: Number(form.weight) || 1,
        claim_days: form.requires_claim && form.claim_days !== '' ? form.claim_days : '',
        stock: form.stock_unlimited ? '' : (form.stock === '' ? '0' : form.stock),
      }).forEach(([key, value]) => {
        if (key === 'image_url' || key === 'stock_unlimited') return
        if (typeof value === 'boolean') fd.append(key, value ? '1' : '0')
        else if (key === 'stock') fd.append(key, form.stock_unlimited ? '' : String(value === '' ? 0 : value))
        else if (value !== null && value !== undefined && value !== '') fd.append(key, String(value))
      })

      if (imageFile) {
        fd.append('image', imageFile)
      } else if (removeStored) {
        fd.append('remove_image', '1')
      }

      let saved
      if (isNew || !segmentId) {
        const { data } = await api.upload(`/spinwheel/admin/wheels/${wheelId}/segments`, fd)
        saved = data
        setDirty(false)
        setMsg('Prize created')
        if (saved?.id) {
          navigate(`/admin/spinwheel/prizes/${saved.id}`, { replace: true })
        }
        return
      }

      const { data } = await api.upload(`/spinwheel/admin/segments/${segmentId}`, fd)
      saved = data
      const url = mediaUrl(saved.image_url || saved.image_path)
      revokeObjectUrl()
      setImageFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setStoredImageUrl(url || null)
      setImagePreview(url || null)
      setRemoveStored(false)
      setForm((f) => ({ ...f, image_url: url }))
      setDirty(false)
      setMsg(url ? 'Prize saved' : 'Prize saved · image cleared')
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to save prize'))
    } finally {
      setBusy(false)
    }
  }

  const displayName = imageFile?.name
    || (imagePreview && !removeStored ? 'Current image' : null)

  return (
    <div className="admin-body spinwheel-admin">
      <div style={{ marginBottom: 12 }}>
        <Link to="/admin/spinwheel/wheel" className="admin-btn">← Back to Wheel Management</Link>
      </div>
      {(msg || error) && <div className={`admin-flash ${error ? 'err' : 'ok'}`}>{error || msg}</div>}
      {dirty && !error && <div className="admin-flash warn">You have unsaved changes.</div>}

      <form onSubmit={save} className="admin-grid">
        <div className="admin-card">
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>{isNew ? 'Add prize' : 'Edit prize'}</h2>

          <h3 style={{ fontSize: '0.95rem', marginBottom: 0 }}>Basic details</h3>
          <label className="admin-label">Prize name</label>
          <input
            className="admin-input"
            required
            value={form.prize_label}
            onChange={(e) => {
              const prize_label = e.target.value
              const syncDisplay = !form.display_label || form.display_label === form.prize_label
              patch({
                prize_label,
                name: prize_label,
                ...(syncDisplay ? { display_label: prize_label } : {}),
              })
            }}
          />
          <label className="admin-label">Wheel display label</label>
          <input className="admin-input" required value={form.display_label} onChange={(e) => patch({ display_label: e.target.value })} />
          <label className="admin-label">Full description</label>
          <textarea className="admin-textarea" value={form.description} onChange={(e) => patch({ description: e.target.value })} />
          <label className="admin-label">Winning message</label>
          <input className="admin-input" required value={form.winning_message} onChange={(e) => patch({ winning_message: e.target.value })} />

          <label className="admin-label">Picture / icon</label>
          <div className="image-picker">
            <div className="image-picker-preview">
              {imagePreview ? (
                <img src={imagePreview} alt="" />
              ) : (
                <span className="image-picker-empty">
                  {(form.prize_label || '?').slice(0, 1)}
                </span>
              )}
            </div>
            <div className="image-picker-actions">
              <input
                ref={fileInputRef}
                id="prize-image-input"
                className="image-picker-input"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml,image/bmp"
                onChange={onFileChange}
              />
              <label htmlFor="prize-image-input" className="admin-btn admin-btn-primary image-picker-choose">
                {imagePreview ? 'Change picture' : 'Choose picture'}
              </label>
              {imagePreview && (
                <button type="button" className="admin-btn admin-btn-danger" onClick={clearImage} disabled={busy}>
                  Remove
                </button>
              )}
              <p className="admin-muted" style={{ margin: '0.35rem 0 0' }}>
                {displayName
                  ? <>Selected: <strong style={{ color: 'var(--admin-text)' }}>{displayName}</strong>{removeStored ? ' · will clear on save' : ''}</>
                  : 'PNG, JPG, WebP, GIF, or SVG · max 4 MB'}
              </p>
              {removeStored && !imageFile && (
                <p className="admin-muted" style={{ margin: '0.2rem 0 0', color: 'var(--color-danger)' }}>
                  Image marked for removal. Save prize to apply.
                </p>
              )}
            </div>
          </div>

          <h3 style={{ fontSize: '0.95rem', marginTop: '1.2rem' }}>Winning configuration</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label className="admin-label">Weight</label>
              <input className="admin-input" type="number" min={1} required value={form.weight} onChange={(e) => patch({ weight: e.target.value })} />
            </div>
            <div>
              <label className="admin-label">Tier</label>
              <select className="admin-select" value={form.tier} onChange={(e) => patch({ tier: e.target.value })}>
                <option value="minor">Minor</option>
                <option value="major">Major</option>
              </select>
            </div>
            <div>
              <label className="admin-label">Color</label>
              <input className="admin-input" type="color" value={form.color} onChange={(e) => patch({ color: e.target.value })} />
            </div>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: '0.9rem' }}>
            <input type="checkbox" checked={!!form.is_active} onChange={(e) => patch({ is_active: e.target.checked })} />
            Active on wheel
          </label>

          <h3 style={{ fontSize: '0.95rem', marginTop: '1.2rem' }}>Inventory</h3>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={!!form.stock_unlimited}
              onChange={(e) => patch({
                stock_unlimited: e.target.checked,
                stock: e.target.checked ? '' : (form.stock === '' ? 10 : form.stock),
              })}
            />
            Unlimited stock
          </label>
          {!form.stock_unlimited && (
            <>
              <label className="admin-label">Remaining stock</label>
              <input
                className="admin-input"
                type="number"
                min={0}
                required
                value={form.stock}
                onChange={(e) => patch({ stock: e.target.value })}
              />
              <p className="admin-muted" style={{ margin: '0.35rem 0 0' }}>
                When stock hits 0 the prize deactivates automatically and admins get a red alert on Spinwheel.
              </p>
            </>
          )}

          <h3 style={{ fontSize: '0.95rem', marginTop: '1.2rem' }}>Collection configuration</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="admin-label">Staff collection</label>
              <select
                className="admin-select"
                value={form.requires_claim ? 'yes' : 'no'}
                onChange={(e) => patch({
                  requires_claim: e.target.value === 'yes',
                  claim_days: e.target.value === 'yes' ? (form.claim_days || 7) : '',
                })}
              >
                <option value="yes">Required</option>
                <option value="no">Not required</option>
              </select>
            </div>
            <div>
              <label className="admin-label">Validity days after win (blank = none)</label>
              <input
                className="admin-input"
                type="number"
                min={1}
                disabled={!form.requires_claim}
                value={form.claim_days}
                onChange={(e) => patch({ claim_days: e.target.value })}
              />
            </div>
          </div>
          <label className="admin-label">Redemption instructions</label>
          <textarea className="admin-textarea" value={form.instructions} onChange={(e) => patch({ instructions: e.target.value })} />

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save prize'}</button>
            <Link className="admin-btn" to="/admin/spinwheel/wheel" onClick={(e) => { if (dirty && !window.confirm('Discard unsaved changes?')) e.preventDefault() }}>Cancel</Link>
          </div>
        </div>

        <div className="admin-card admin-preview">
          <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Previews</h2>
          <p className="admin-muted">Wheel segment</p>
          <div className="spinwheel-preview-panel" style={{ borderRadius: 12, padding: '1rem 0.5rem', background: 'linear-gradient(180deg, var(--color-surface), var(--color-surface-2))', border: '1px solid var(--color-line)' }}>
            <SpinWheel segments={previewSegment} />
          </div>
          <p className="admin-muted" style={{ marginTop: 16 }}>Reward card</p>
          <div className="reward-card" style={{ pointerEvents: 'none' }}>
            {imagePreview ? (
              <img className="media" src={imagePreview} alt="" />
            ) : (
              <div className="media-fallback">{(form.prize_label || '?').slice(0, 1)}</div>
            )}
            <strong>{form.prize_label || 'Prize name'}</strong>
            <p style={{ margin: '0.35rem 0 0', opacity: 0.8, fontSize: '0.85rem' }}>{form.display_label || 'Display label'}</p>
          </div>
          <p className="admin-muted" style={{ marginTop: 16 }}>Detail snippet</p>
          <div className="admin-muted">
            <div><strong style={{ color: 'var(--admin-text)' }}>{form.prize_label || 'Prize name'}</strong></div>
            <div>{form.description || 'Description preview'}</div>
            <div>{form.instructions || 'Instructions preview'}</div>
          </div>
        </div>
      </form>
    </div>
  )
}
