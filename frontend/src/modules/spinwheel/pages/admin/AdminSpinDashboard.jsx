import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../../context/AuthContext'
import api, { getErrorMessage } from '../../../../lib/api'
import { Skeleton } from '../../components/ui'
import '../../styles/spinwheel.css'

const modules = [
  {
    to: '/admin/spinwheel/wheel',
    title: 'Wheel & Prizes',
    body: 'Brand title, logo, wheel setup, and prize media.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 4v3M12 17v3M4 12h3M17 12h3" />
      </svg>
    ),
  },
  {
    to: '/admin/spinwheel/usage',
    title: 'Customer & Spins',
    body: 'Grant spins and review usage records.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M4 12a8 8 0 0 1 13.5-5.8M20 12a8 8 0 0 1-13.5 5.8" />
        <path d="M17 4v4h4M7 20v-4H3" />
      </svg>
    ),
  },
  {
    to: '/admin/spinwheel/guest-spins',
    title: 'Guest Spins',
    body: 'Generate and manage one-spin guest links.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
        <path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
      </svg>
    ),
  },
  {
    to: '/admin/spinwheel/rewards',
    title: 'Reward Verification',
    body: 'Confirm physical prize collection with references.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M9 12.5 11 14.5 15.5 10" />
        <rect x="4" y="4" width="16" height="16" rx="3" />
      </svg>
    ),
  },
]

export default function AdminSpinDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [recent, setRecent] = useState([])

  useEffect(() => {
    ;(async () => {
      try {
        const [usagesRes, rewardsRes, guestsRes, wheelsRes] = await Promise.all([
          api.get('/spinwheel/admin/usages'),
          api.get('/spinwheel/admin/rewards'),
          api.get('/spinwheel/admin/guest-spins'),
          api.get('/spinwheel/admin/wheels'),
        ])
        const usages = usagesRes.data || []
        const rewards = rewardsRes.data || []
        const guests = guestsRes.data || []
        const wheels = wheelsRes.data || []
        const available = usages.filter((u) => u.status === 'available').length
        const used = usages.filter((u) => u.status === 'used').length
        const awaiting = rewards.filter((r) => r.display_status === 'ready_to_collect').length
        const claimed = rewards.filter((r) => r.display_status === 'claimed').length
        const expired = rewards.filter((r) => r.display_status === 'expired').length

        setStats({
          wheels: wheels.length,
          totalUsages: usages.length,
          available,
          used,
          rewards: rewards.length,
          awaiting,
          claimed,
          expired,
          guests: guests.filter((g) => ['available', 'reserved'].includes(g.status)).length,
        })
        setRecent(rewards.slice(0, 8))
      } catch (err) {
        setError(getErrorMessage(err, 'Unable to load dashboard'))
      }
    })()
  }, [])

  return (
    <div className="admin-body spinwheel-admin">
      {error && <div className="admin-flash err">{error}</div>}

      <section className="admin-hero">
        <div>
          <h3>Welcome, {user?.name || 'Administrator'}!</h3>
          <p>Logged in as Staff Administrator · Spin Wheel module</p>
        </div>
      </section>

      <div className="stat-grid">
        {!stats ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={88} radius={12} />)
        ) : (
          <>
            <div className="stat-card"><span>Wheels</span><strong>{stats.wheels}</strong></div>
            <div className="stat-card"><span>Total spin records</span><strong>{stats.totalUsages}</strong></div>
            <div className="stat-card"><span>Available spins</span><strong>{stats.available}</strong></div>
            <div className="stat-card"><span>Rewards issued</span><strong>{stats.rewards}</strong></div>
            <div className="stat-card"><span>Awaiting collection</span><strong>{stats.awaiting}</strong></div>
            <div className="stat-card"><span>Claimed / Expired</span><strong>{stats.claimed} / {stats.expired}</strong></div>
          </>
        )}
      </div>

      <h3 className="admin-section-title">Operational Modules</h3>
      <div className="admin-module-grid">
        {modules.map((mod) => (
          <Link key={mod.to} to={mod.to} className="admin-module-card">
            <div className="admin-module-icon">{mod.icon}</div>
            <div className="admin-module-copy">
              <strong>{mod.title}</strong>
              <p>{mod.body}</p>
            </div>
            <span className="admin-module-chevron" aria-hidden>›</span>
          </Link>
        ))}
      </div>

      <div className="admin-card" style={{ marginTop: '1.15rem' }}>
        <div className="admin-card-head">
          <h3>Recent rewards</h3>
          <Link to="/admin/spinwheel/rewards" className="admin-btn admin-btn-primary">Open verification</Link>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Prize</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td><code>{r.reward_code}</code></td>
                  <td>{r.is_guest ? (r.guest_reference || 'Guest') : (r.user?.name || '—')}</td>
                  <td>{r.prize_label}</td>
                  <td>{r.status_label}</td>
                </tr>
              ))}
              {!recent.length && !error && (
                <tr><td colSpan={4} className="admin-muted">No rewards yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
