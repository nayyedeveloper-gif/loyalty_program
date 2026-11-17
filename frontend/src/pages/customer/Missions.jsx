import { useEffect, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import api, { getErrorMessage } from '../../lib/api'
import { faTrophy } from '../../lib/icons'
import PageHeader from '../../components/PageHeader'

export default function CustomerMissions() {
  const { t } = useLanguage()
  const [missions, setMissions] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .get('/customer/missions')
      .then((res) => setMissions(res.data.missions || []))
      .catch((err) => setError(getErrorMessage(err, t('somethingWrong'))))
      .finally(() => setLoading(false))
  }, [t])

  function statusLabel(status) {
    if (status === 'reward_received') return t('missionRewardReceived')
    if (status === 'ended') return t('missionEnded')
    return t('missionInProgress')
  }

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        showBack
        title={t('missions')}
        subtitle={t('missionsCopy')}
        icon={faTrophy}
      />

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {loading && (
        <div className="loading-state" role="status" aria-live="polite">
          {t('loading')}
        </div>
      )}

      {!loading && !missions.length && (
        <div className="empty-panel">
          <p className="empty-panel-title">{t('noMissionsFound')}</p>
          <p className="empty-panel-copy">{t('noMissionsCopy')}</p>
        </div>
      )}

      <div className="space-y-3">
        {missions.map((mission) => {
          const pct = mission.goal_target
            ? Math.min(100, Math.round((mission.progress / mission.goal_target) * 100))
            : 0
          return (
            <section key={mission.id} className="stat-card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="section-heading">{mission.title}</h2>
                <span className="type-small text-[var(--color-muted)]">
                  +{mission.bonus_points} {t('points')}
                </span>
              </div>
              <p className="type-small text-[var(--color-muted)] m-0">{mission.description}</p>
              <div className="type-meta text-[var(--color-muted)]">
                {Number(mission.progress || 0).toLocaleString()} /{' '}
                {Number(mission.goal_target || 0).toLocaleString()}
                {' · '}
                {statusLabel(mission.status)}
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
