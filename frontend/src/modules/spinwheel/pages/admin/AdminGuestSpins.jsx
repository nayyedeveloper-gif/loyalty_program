import { useCallback, useEffect, useState } from 'react'
import api, { getErrorMessage } from '../../../../lib/api'
import { ConfirmDialog, Modal, StatusBadge } from '../../components/ui'
import '../../styles/spinwheel.css'

export default function AdminGuestSpins() {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const [detail, setDetail] = useState(null)
  const [revokeTarget, setRevokeTarget] = useState(null)
  const [hours, setHours] = useState(72)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const { data } = await api.get('/spinwheel/admin/guest-spins', {
        params: {
          q: q || undefined,
          status: status || undefined,
        },
      })
      setRows(data || [])
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load guest spins'))
    } finally {
      setBusy(false)
    }
  }, [q, status])

  useEffect(() => {
    load()
  }, [load])

  const guestPublicUrl = (data) => {
    if (data.url) return data.url
    if (data.path) return `${window.location.origin}${data.path}`
    if (data.access_token) return `${window.location.origin}/guest/${data.access_token}`
    return ''
  }

  const generate = async () => {
    setBusy(true)
    try {
      const { data } = await api.post('/spinwheel/admin/guest-spins', {
        valid_hours: Number(hours),
      })
      const url = guestPublicUrl(data)
      setCreated({ ...data, url })
      setMsg(`Generated ${data.entitlement?.reference || 'guest link'}`)
      setError('')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to generate guest link'))
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url)
      setMsg('Guest link copied')
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to copy link'))
    }
  }

  const openDetail = async (row) => {
    setBusy(true)
    try {
      const { data } = await api.get(`/spinwheel/admin/guest-spins/${row.id}`)
      setDetail(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load guest spin'))
    } finally {
      setBusy(false)
    }
  }

  const revoke = async () => {
    if (!revokeTarget) return
    setBusy(true)
    try {
      await api.post(`/spinwheel/admin/guest-spins/${revokeTarget.id}/revoke`, {})
      setMsg(`Revoked ${revokeTarget.reference}`)
      setRevokeTarget(null)
      setDetail(null)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to revoke guest link'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-body spinwheel-admin">
      {(msg || error) && <div className={`admin-flash ${error ? 'err' : 'ok'}`}>{error || msg}</div>}

      <section style={{ display: 'grid', gap: '1rem' }}>
        <div className="admin-card" style={{ maxWidth: 560 }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Generate guest spin link</h2>
          <p className="admin-muted">Creates exactly one spin entitlement for an offline customer. The raw link is shown once.</p>
          <label className="admin-label">Valid for (hours)</label>
          <input className="admin-input" type="number" min={1} value={hours} onChange={(e) => setHours(e.target.value)} />
          <button type="button" className="admin-btn admin-btn-primary" style={{ marginTop: 12 }} disabled={busy} onClick={generate}>
            Generate guest link
          </button>
        </div>

        <form
          className="admin-card"
          onSubmit={(e) => {
            e.preventDefault()
            load()
          }}
        >
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Guest links</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="admin-input" style={{ maxWidth: 280 }} placeholder="Reference or reward code" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="admin-select" style={{ maxWidth: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="used">Used</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
            </select>
            <button type="submit" className="admin-btn" disabled={busy}>Filter</button>
          </div>
        </form>

        <div className="admin-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Guest reference</th>
                  <th>Created</th>
                  <th>Created by</th>
                  <th>Status</th>
                  <th>Spin result</th>
                  <th>Reward</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><code>{row.reference}</code></td>
                    <td>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                    <td>{row.created_by?.name || '—'}</td>
                    <td>{row.status}</td>
                    <td>{row.prize_label || '—'}</td>
                    <td>{row.reward_code ? <code>{row.reward_code}</code> : '—'}</td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" className="admin-btn" onClick={() => openDetail(row)}>View</button>
                      {['available', 'reserved'].includes(row.status) && (
                        <button type="button" className="admin-btn admin-btn-danger" onClick={() => setRevokeTarget(row)}>Revoke</button>
                      )}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={7} className="admin-muted">No guest links yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Modal open={!!created} onClose={() => setCreated(null)} tone="admin">
        {created && (
          <>
            <h3 style={{ marginTop: 0 }}>Guest link created</h3>
            <p><strong>Reference:</strong> <code>{created.entitlement?.reference}</code></p>
            <p className="admin-muted">{created.note}</p>
            <textarea
              className="admin-input"
              readOnly
              rows={3}
              value={created.url}
              style={{ width: '100%', marginTop: 8 }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button type="button" className="admin-btn admin-btn-primary" onClick={() => copyLink(created.url)}>Copy link</button>
              <button type="button" className="admin-btn" onClick={() => setCreated(null)}>Close</button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} tone="admin">
        {detail && (
          <>
            <h3 style={{ marginTop: 0 }}>Guest link details</h3>
            <p><strong>Reference:</strong> <code>{detail.entitlement?.reference}</code></p>
            <p><strong>Status:</strong> {detail.entitlement?.status}</p>
            <p><strong>Created:</strong> {detail.entitlement?.created_at ? new Date(detail.entitlement.created_at).toLocaleString() : '—'}</p>
            <p><strong>Created by:</strong> {detail.entitlement?.created_by?.name || '—'}</p>
            <p><strong>Expires:</strong> {detail.entitlement?.expires_at ? new Date(detail.entitlement.expires_at).toLocaleString() : '—'}</p>
            {detail.result && (
              <>
                <hr style={{ border: 0, borderTop: '1px solid var(--admin-border)', margin: '12px 0' }} />
                <p><strong>Reward:</strong> <code>{detail.result.reward_code}</code></p>
                <p><strong>Prize:</strong> {detail.result.prize_label}</p>
                <p><StatusBadge status={detail.result.display_status} label={detail.result.status_label} /></p>
              </>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {['available', 'reserved'].includes(detail.entitlement?.status) && (
                <button type="button" className="admin-btn admin-btn-danger" onClick={() => setRevokeTarget(detail.entitlement)}>Revoke</button>
              )}
              <button type="button" className="admin-btn" onClick={() => setDetail(null)}>Close</button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke guest link?"
        body={revokeTarget ? `Revoke ${revokeTarget.reference}. The recipient will no longer be able to spin.` : ''}
        confirmLabel="Revoke link"
        danger
        busy={busy}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={revoke}
      />
    </div>
  )
}
