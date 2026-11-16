import { useEffect, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import api, { getErrorMessage } from '../../lib/api'
import { faTrophy } from '../../lib/icons'
import PageHeader from '../../components/PageHeader'

export default function CustomerMissions() {
  const { t } = useLanguage()
  const [missions, setMissions] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/customer/missions')
      .then((res) => setMissions(res.data.missions || []))
      .catch((err) => setError(getErrorMessage(err, t('somethingWrong'))))
  }, [t])

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title={t('missions')}
        subtitle={t('missionsCopy')}
        icon={faTrophy}
        backTo="/app"
        backLabel={t('backToMembership')}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}

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
                {mission.progress} / {mission.goal_target}
                {mission.completed ? ` · ${t('completed')}` : ''}
              </div>
              <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
