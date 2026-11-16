import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { getErrorMessage } from '../../../../lib/api'
import { ConfirmDialog } from '../../components/ui'
import '../../styles/spinwheel.css'

const defaultSettings = {
  grant_on_registration: 0,
  login_promo_active: false,
  grant_on_login_promo: 0,
  default_valid_hours: 24,
}

const blankPromo = {
  title: '',
  message: '',
  spin_count: 1,
  valid_hours: 24,
  starts_at: '',
  ends_at: '',
  is_active: true,
}

function toLocalInput(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export default function AdminSpinUsage() {
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [grant, setGrant] = useState({ count: 1, valid_hours: 24 })
  const [usages, setUsages] = useState([])
  const [settings, setSettings] = useState(defaultSettings)
  const [promos, setPromos] = useState([])
  const [promoForm, setPromoForm] = useState(blankPromo)
  const [editingPromoId, setEditingPromoId] = useState(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState(null)
  const [confirmGrant, setConfirmGrant] = useState(false)
  const [deletePromo, setDeletePromo] = useState(null)

  const loadCustomers = useCallback(async () => {
    const { data } = await api.get('/admin/customers', { params: { per_page: 200 } })
    const list = (data.customers?.data || []).filter(
      (u) => u.email !== 'guest-pool@spinwheel.local' && !String(u.name || '').toLowerCase().includes('guest spin pool'),
    )
    setCustomers(list)
  }, [])

  const loadUsages = useCallback(async (id) => {
    const { data } = await api.get('/spinwheel/admin/usages', {
      params: id ? { user_id: id } : undefined,
    })
    setUsages(data || [])
  }, [])

  const loadSettings = useCallback(async () => {
    const { data } = await api.get('/spinwheel/admin/settings')
    setSettings({ ...defaultSettings, ...(data || {}) })
  }, [])

  const loadPromos = useCallback(async () => {
    const { data } = await api.get('/spinwheel/admin/promos')
    setPromos(data || [])
  }, [])

  useEffect(() => {
    Promise.all([loadCustomers(), loadSettings(), loadUsages(''), loadPromos()])
      .catch((err) => setError(getErrorMessage(err, 'Unable to load spin credits')))
  }, [loadCustomers, loadSettings, loadUsages, loadPromos])

  useEffect(() => {
    if (!customerId) {
      loadUsages('').catch(() => {})
      return
    }
    loadUsages(customerId).catch((err) => setError(getErrorMessage(err, 'Unable to load usages')))
  }, [customerId, loadUsages])

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((u) => {
      const hay = [u.name, u.email, u.phone, u.customer_code, String(u.id)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [customers, search])

  const selected = customers.find((u) => String(u.id) === String(customerId))
  const available = usages.filter((u) => u.status === 'available').length

  const doGrant = async () => {
    setBusy(true)
    try {
      await api.post('/spinwheel/admin/usages/grant', {
        user_id: Number(customerId),
        count: Number(grant.count),
        valid_hours: Number(grant.valid_hours),
        source: 'manual',
      })
      setMsg(`Granted ${grant.count} spin(s) to ${selected?.name || 'customer'}`)
      setError('')
      setConfirmGrant(false)
      await loadUsages(customerId)
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to grant spins'))
    } finally {
      setBusy(false)
    }
  }

  const revoke = async () => {
    if (!revokeTarget) return
    setBusy(true)
    try {
      await api.put(`/spinwheel/admin/usages/${revokeTarget.id}`, { status: 'revoked' })
      setMsg('Spin revoked')
      setRevokeTarget(null)
      await loadUsages(customerId || '')
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to revoke spin'))
    } finally {
      setBusy(false)
    }
  }

  async function saveSettings(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload = {
        ...settings,
        login_promo_active: !!settings.login_promo_active,
        grant_on_registration: Number(settings.grant_on_registration),
        grant_on_login_promo: Number(settings.grant_on_login_promo),
        default_valid_hours: Number(settings.default_valid_hours),
      }
      const { data } = await api.put('/spinwheel/admin/settings', payload)
      setSettings({ ...defaultSettings, ...(data || {}) })
      setMsg('Automatic grant settings saved.')
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to save settings'))
    } finally {
      setBusy(false)
    }
  }

  function startEditPromo(promo) {
    setEditingPromoId(promo.id)
    setPromoForm({
      title: promo.title || '',
      message: promo.message || '',
      spin_count: promo.spin_count ?? 1,
      valid_hours: promo.valid_hours ?? 24,
      starts_at: toLocalInput(promo.starts_at),
      ends_at: toLocalInput(promo.ends_at),
      is_active: promo.is_active !== false,
    })
  }

  function resetPromoForm() {
    setEditingPromoId(null)
    setPromoForm(blankPromo)
  }

  async function savePromo(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload = {
        title: promoForm.title,
        message: promoForm.message,
        spin_count: Number(promoForm.spin_count),
        valid_hours: Number(promoForm.valid_hours),
        starts_at: fromLocalInput(promoForm.starts_at),
        ends_at: fromLocalInput(promoForm.ends_at),
        is_active: !!promoForm.is_active,
      }
      if (editingPromoId) {
        await api.put(`/spinwheel/admin/promos/${editingPromoId}`, payload)
        setMsg('Promo session updated.')
      } else {
        await api.post('/spinwheel/admin/promos', payload)
        setMsg('Promo session created. Members will see it on Spinwheel.')
      }
      resetPromoForm()
      await loadPromos()
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to save promo'))
    } finally {
      setBusy(false)
    }
  }

  async function togglePromoActive(promo) {
    setBusy(true)
    setError('')
    try {
      await api.put(`/spinwheel/admin/promos/${promo.id}`, { is_active: !promo.is_active })
      setMsg(promo.is_active ? 'Promo deactivated.' : 'Promo activated.')
      await loadPromos()
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update promo'))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDeletePromo() {
    if (!deletePromo) return
    setBusy(true)
    try {
      await api.delete(`/spinwheel/admin/promos/${deletePromo.id}`)
      setMsg('Promo deleted.')
      if (editingPromoId === deletePromo.id) resetPromoForm()
      setDeletePromo(null)
      await loadPromos()
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to delete promo'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-body spinwheel-admin">
      {(msg || error) && <div className={`admin-flash ${error ? 'err' : 'ok'}`}>{error || msg}</div>}

      <section className="admin-usage-layout">
        <div className="admin-card">
          <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem' }}>Find member</h2>
          <p className="admin-muted" style={{ marginTop: 0 }}>
            Search any registered customer, then grant spins or review their allocations.
          </p>
          <label className="admin-label">Search</label>
          <input
            className="admin-input"
            placeholder="Name, email, phone, or member code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="admin-label" style={{ marginTop: 12 }}>
            Members ({filteredCustomers.length}/{customers.length})
          </label>
          <select
            className="admin-select"
            size={Math.min(10, Math.max(4, filteredCustomers.length || 4))}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Select a member…</option>
            {filteredCustomers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.customer_code || u.email || u.phone || `#${u.id}`}
              </option>
            ))}
          </select>
          {selected && (
            <p className="admin-muted" style={{ marginTop: 10 }}>
              Selected: <strong style={{ color: 'var(--admin-text)' }}>{selected.name}</strong>
              {' · '}available spins: {available}
            </p>
          )}
          {!customers.length && (
            <p className="admin-muted" style={{ marginTop: 10 }}>No customers found yet.</p>
          )}
        </div>

        <form
          className="admin-card"
          onSubmit={(e) => {
            e.preventDefault()
            if (!customerId) {
              setError('Select a member before granting spins.')
              return
            }
            setConfirmGrant(true)
          }}
        >
          <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem' }}>Manual grant</h2>
          <p className="admin-muted" style={{ marginTop: 0 }}>
            Directly add spins to the selected member. This does not replace existing credits.
          </p>
          <label className="admin-label">Spin count</label>
          <input
            className="admin-input"
            type="number"
            min={1}
            max={50}
            required
            value={grant.count}
            onChange={(e) => setGrant({ ...grant, count: e.target.value })}
          />
          <label className="admin-label">Valid for (hours)</label>
          <input
            className="admin-input"
            type="number"
            min={1}
            max={8760}
            required
            value={grant.valid_hours}
            onChange={(e) => setGrant({ ...grant, valid_hours: e.target.value })}
          />
          <button type="submit" className="admin-btn admin-btn-primary" style={{ marginTop: 12 }} disabled={busy || !customerId}>
            Grant spins
          </button>
        </form>

        <form className="admin-card" onSubmit={saveSettings}>
          <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem' }}>Automatic grants</h2>
          <p className="admin-muted" style={{ marginTop: 0 }}>
            Background rules for registration and login. Separate from promo popups on Spinwheel.
          </p>
          <label className="admin-label">Spins on registration</label>
          <input
            className="admin-input"
            type="number"
            min={0}
            max={50}
            value={settings.grant_on_registration}
            onChange={(e) => setSettings({ ...settings, grant_on_registration: e.target.value })}
          />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={!!settings.login_promo_active}
              onChange={(e) => setSettings({ ...settings, login_promo_active: e.target.checked })}
            />
            Login promotion active
          </label>
          <label className="admin-label">Spins on promo login</label>
          <input
            className="admin-input"
            type="number"
            min={0}
            max={50}
            value={settings.grant_on_login_promo}
            onChange={(e) => setSettings({ ...settings, grant_on_login_promo: e.target.value })}
          />
          <label className="admin-label">Default validity (hours)</label>
          <input
            className="admin-input"
            type="number"
            min={1}
            value={settings.default_valid_hours}
            onChange={(e) => setSettings({ ...settings, default_valid_hours: e.target.value })}
          />
          <button type="submit" className="admin-btn admin-btn-primary" style={{ marginTop: 12 }} disabled={busy}>
            Save automatic settings
          </button>
        </form>

        <div className="admin-card admin-card-span">
          <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem' }}>Promo sessions</h2>
          <p className="admin-muted" style={{ marginTop: 0 }}>
            Members see an active promo as a popup when they open Spinwheel. Claiming grants spins; closing dismisses with no reward. A notification dot appears on the Spinwheel tab while a promo is waiting.
          </p>

          <form onSubmit={savePromo} className="promo-form-grid">
            <div>
              <label className="admin-label">Title</label>
              <input
                className="admin-input"
                required
                value={promoForm.title}
                onChange={(e) => setPromoForm({ ...promoForm, title: e.target.value })}
                placeholder="Weekend spin gift"
              />
            </div>
            <div className="promo-form-span">
              <label className="admin-label">Popup message</label>
              <textarea
                className="admin-textarea"
                required
                rows={3}
                value={promoForm.message}
                onChange={(e) => setPromoForm({ ...promoForm, message: e.target.value })}
                placeholder="Claim a free spin for this week’s promotion."
              />
            </div>
            <div>
              <label className="admin-label">Spins on claim</label>
              <input
                className="admin-input"
                type="number"
                min={1}
                max={50}
                required
                value={promoForm.spin_count}
                onChange={(e) => setPromoForm({ ...promoForm, spin_count: e.target.value })}
              />
            </div>
            <div>
              <label className="admin-label">Spin validity (hours)</label>
              <input
                className="admin-input"
                type="number"
                min={1}
                max={8760}
                required
                value={promoForm.valid_hours}
                onChange={(e) => setPromoForm({ ...promoForm, valid_hours: e.target.value })}
              />
            </div>
            <div>
              <label className="admin-label">Starts (optional)</label>
              <input
                className="admin-input"
                type="datetime-local"
                value={promoForm.starts_at}
                onChange={(e) => setPromoForm({ ...promoForm, starts_at: e.target.value })}
              />
            </div>
            <div>
              <label className="admin-label">Ends (optional)</label>
              <input
                className="admin-input"
                type="datetime-local"
                value={promoForm.ends_at}
                onChange={(e) => setPromoForm({ ...promoForm, ends_at: e.target.value })}
              />
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={!!promoForm.is_active}
                onChange={(e) => setPromoForm({ ...promoForm, is_active: e.target.checked })}
              />
              Active now
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
                {editingPromoId ? 'Update promo' : 'Create promo session'}
              </button>
              {editingPromoId && (
                <button type="button" className="admin-btn" onClick={resetPromoForm} disabled={busy}>
                  Cancel edit
                </button>
              )}
            </div>
          </form>

          <div style={{ overflowX: 'auto', marginTop: '1.25rem' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Spins</th>
                  <th>Status</th>
                  <th>Claimed</th>
                  <th>Dismissed</th>
                  <th>Window</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {promos.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.title}</strong>
                      <div className="admin-muted" style={{ fontSize: '0.8rem' }}>{p.message}</div>
                    </td>
                    <td>{p.spin_count}</td>
                    <td>{p.is_active ? 'Active' : 'Off'}</td>
                    <td>{p.claimed_count ?? 0}</td>
                    <td>{p.dismissed_count ?? 0}</td>
                    <td className="admin-muted" style={{ whiteSpace: 'nowrap' }}>
                      {p.starts_at ? new Date(p.starts_at).toLocaleString() : '—'}
                      {' → '}
                      {p.ends_at ? new Date(p.ends_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="admin-btn" onClick={() => startEditPromo(p)} disabled={busy}>Edit</button>{' '}
                      <button type="button" className="admin-btn" onClick={() => togglePromoActive(p)} disabled={busy}>
                        {p.is_active ? 'Deactivate' : 'Activate'}
                      </button>{' '}
                      <button type="button" className="admin-btn admin-btn-danger" onClick={() => setDeletePromo(p)} disabled={busy}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!promos.length && (
                  <tr>
                    <td colSpan={7} className="admin-muted">No promo sessions yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-card admin-card-span">
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>
            Allocation & history{selected ? ` · ${selected.name}` : ''}
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Granted</th>
                  <th>Expires</th>
                  <th>Result</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {usages.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.user?.name || u.user_id}</td>
                    <td>{u.source || '—'}</td>
                    <td>{u.status}</td>
                    <td>{u.granted_at ? new Date(u.granted_at).toLocaleString() : '—'}</td>
                    <td>{u.expires_at ? new Date(u.expires_at).toLocaleString() : '—'}</td>
                    <td>{u.result?.prize_label || '—'}</td>
                    <td>
                      {u.status === 'available' && (
                        <button type="button" className="admin-btn admin-btn-danger" onClick={() => setRevokeTarget(u)}>
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!usages.length && (
                  <tr><td colSpan={8} className="admin-muted">No spin usage records.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirmGrant}
        title="Grant spin usages?"
        body={`Add ${grant.count} spin(s) valid for ${grant.valid_hours} hour(s) to ${selected?.name || 'the selected member'}.`}
        confirmLabel="Confirm grant"
        busy={busy}
        onCancel={() => setConfirmGrant(false)}
        onConfirm={doGrant}
      />

      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke available spin?"
        body="This removes an unused spin allocation. Used spins cannot be restored."
        confirmLabel="Revoke spin"
        danger
        busy={busy}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={revoke}
      />

      <ConfirmDialog
        open={!!deletePromo}
        title="Delete promo session?"
        body="Members who already claimed or dismissed keep their response history removed with this promo."
        confirmLabel="Delete promo"
        danger
        busy={busy}
        onCancel={() => setDeletePromo(null)}
        onConfirm={confirmDeletePromo}
      />
    </div>
  )
}
