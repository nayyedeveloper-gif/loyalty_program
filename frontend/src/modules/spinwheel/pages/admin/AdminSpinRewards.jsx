import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../../../../lib/api'
import { mediaUrl } from '../../lib/media'
import { ConfirmDialog, Modal, StatusBadge } from '../../components/ui'
import '../../styles/spinwheel.css'

export default function AdminSpinRewards() {
  const [q, setQ] = useState('')
  const [audience, setAudience] = useState('all')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [confirmClaim, setConfirmClaim] = useState(false)
  const [confirmOverride, setConfirmOverride] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const search = async () => {
    setBusy(true)
    try {
      const { data } = await api.get('/spinwheel/admin/rewards', {
        params: {
          q: q || undefined,
          audience: audience && audience !== 'all' ? audience : undefined,
          status: status || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      })
      setResults(data || [])
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load rewards'))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    search()
  }, [])

  const openReward = async (reward) => {
    setBusy(true)
    try {
      const { data: fresh } = await api.get(`/spinwheel/admin/rewards/${reward.id}`)
      setSelected(fresh)
      setConfirmClaim(false)
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load reward'))
    } finally {
      setBusy(false)
    }
  }

  const markClaimed = async (overrideExpired = false) => {
    if (!selected) return
    setBusy(true)
    try {
      const { data: updated } = await api.post(`/spinwheel/admin/rewards/${selected.id}/claim`, {
        override_expired: overrideExpired,
      })
      setSelected(updated)
      setConfirmClaim(false)
      setConfirmOverride(false)
      setMsg(`Marked ${updated.reward_code} as claimed`)
      await search()
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to claim reward'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-body spinwheel-admin">
      {(msg || error) && <div className={`admin-flash ${error ? 'err' : 'ok'}`}>{error || msg}</div>}
      <section style={{ display: 'grid', gap: '1rem' }}>
        <form
          className="admin-card"
          onSubmit={(e) => {
            e.preventDefault()
            search()
          }}
        >
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Reward verification</h2>
          <p className="admin-muted">Search by reward reference, guest reference, username, or name. Staff marks collection after physical handover.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <input
              className="admin-input"
              style={{ maxWidth: 280 }}
              placeholder="e.g. RW-XXXXXXXXXX or GS-XXXXXXXXXX"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className="admin-select" style={{ maxWidth: 160 }} value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="all">All audiences</option>
              <option value="customer">Registered customers</option>
              <option value="guest">Guest rewards</option>
            </select>
            <select className="admin-select" style={{ maxWidth: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="ready_to_collect">Ready to collect</option>
              <option value="claimed">Claimed</option>
              <option value="expired">Expired</option>
            </select>
            <input className="admin-input" type="date" style={{ maxWidth: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} />
            <input className="admin-input" type="date" style={{ maxWidth: 160 }} value={to} onChange={(e) => setTo(e.target.value)} />
            <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>Search</button>
          </div>
        </form>

        <div className="admin-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Audience</th>
                  <th>Customer</th>
                  <th>Prize</th>
                  <th>Won</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id}>
                    <td><code>{r.reward_code}</code></td>
                    <td>{r.is_guest ? `Guest${r.guest_reference ? ` · ${r.guest_reference}` : ''}` : 'Customer'}</td>
                    <td>{r.is_guest ? (r.guest_reference || 'Guest') : `${r.user?.name || '—'}${r.user?.customer_code ? ` (${r.user.customer_code})` : ''}`}</td>
                    <td>{r.prize_label}</td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                    <td>{r.claim_deadline_at ? new Date(r.claim_deadline_at).toLocaleString() : '—'}</td>
                    <td>{r.status_label}</td>
                    <td>
                      <button type="button" className="admin-btn" onClick={() => openReward(r)}>Open</button>
                    </td>
                  </tr>
                ))}
                {!results.length && (
                  <tr><td colSpan={8} className="admin-muted">No rewards found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Modal open={!!selected} onClose={() => setSelected(null)} tone="admin">
        {selected && (
          <>
            <h3 style={{ marginTop: 0 }}>Verify reward</h3>
            <p><strong>Reference:</strong> <code>{selected.reward_code}</code></p>
            <p><strong>Audience:</strong> {selected.is_guest ? 'Guest' : 'Registered customer'}</p>
            <p><strong>Customer:</strong> {selected.is_guest
              ? (selected.guest_reference || 'Guest pool')
              : `${selected.user?.name || '—'}${selected.user?.customer_code ? ` (${selected.user.customer_code})` : ''}`}</p>
            <p><strong>Prize:</strong> {selected.prize_label}</p>
            {mediaUrl(selected.image_url || selected.image_path) && (
              <img
                src={mediaUrl(selected.image_url || selected.image_path)}
                alt=""
                style={{ width: '100%', maxHeight: 200, objectFit: 'contain', background: 'var(--color-surface-2)', borderRadius: 8 }}
              />
            )}
            <p><strong>Won:</strong> {selected.created_at ? new Date(selected.created_at).toLocaleString() : '—'}</p>
            <p><strong>Status:</strong> <StatusBadge status={selected.display_status} label={selected.status_label} /></p>
            <p><strong>Deadline:</strong> {selected.claim_deadline_at ? new Date(selected.claim_deadline_at).toLocaleString() : 'None'}</p>
            {selected.instructions && <p><strong>Instructions:</strong> {selected.instructions}</p>}
            {selected.claimed_at && (
              <p className="admin-muted">Claimed {new Date(selected.claimed_at).toLocaleString()}</p>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {selected.display_status === 'ready_to_collect' && (
                <button type="button" className="admin-btn admin-btn-primary" onClick={() => setConfirmClaim(true)}>
                  Mark as Claimed
                </button>
              )}
              {selected.display_status === 'expired' && (
                <button type="button" className="admin-btn admin-btn-danger" onClick={() => setConfirmOverride(true)}>
                  Override & claim
                </button>
              )}
              <button type="button" className="admin-btn" onClick={() => setSelected(null)}>Close</button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmClaim && !!selected}
        title="Confirm physical handover?"
        body={selected ? `Mark ${selected.reward_code} as claimed after handing the prize to the recipient.` : ''}
        confirmLabel="Confirm claimed"
        busy={busy}
        onCancel={() => setConfirmClaim(false)}
        onConfirm={() => markClaimed(false)}
      />

      <ConfirmDialog
        open={confirmOverride && !!selected}
        title="Override expired reward?"
        body={selected ? `Reward ${selected.reward_code} is expired. Confirm authorized override after physical handover.` : ''}
        confirmLabel="Override & claim"
        danger
        busy={busy}
        onCancel={() => setConfirmOverride(false)}
        onConfirm={() => markClaimed(true)}
      />
    </div>
  )
}
