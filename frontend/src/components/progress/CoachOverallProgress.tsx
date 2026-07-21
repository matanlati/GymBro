import { useEffect, useState } from 'react'
import type { SelectOption } from '@gymbro/ui-kit'
import { Alert, Card, CardHeader, LoadingState } from '@gymbro/ui-kit'
import { Dumbbell, Target, Trophy } from 'lucide-react'
import {
  CoachProgressOverview,
  CoachProgressPeriod,
  getCoachProgressOverview,
} from '../../api/coach.api'
import ProgressSelect from './ProgressSelect'
import StatCard from './StatCard'

const PERIOD_OPTIONS: SelectOption<CoachProgressPeriod>[] = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
]

const periodLabel = (period: CoachProgressPeriod) =>
  period === 'quarter' ? 'quarter' : period

const comparisonDetail = (overview: CoachProgressOverview) => {
  const { changePercent } = overview.completedWorkouts
  const comparison = `vs previous ${periodLabel(overview.period)}`

  if (changePercent === null) return `New ${comparison}`
  if (changePercent === 0) return `No change ${comparison}`
  return `${changePercent > 0 ? '+' : ''}${changePercent}% ${comparison}`
}

export default function CoachOverallProgress() {
  const [period, setPeriod] = useState<CoachProgressPeriod>('month')
  const [overview, setOverview] = useState<CoachProgressOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    getCoachProgressOverview(period)
      .then(({ data }) => {
        if (active) setOverview(data)
      })
      .catch(() => {
        if (active) {
          setOverview(null)
          setError('Could not load overall trainee progress. Please try again.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [period])

  const changeTone = overview?.completedWorkouts.changePercent
  const workoutAccent = changeTone === null || (changeTone ?? 0) > 0
    ? '#16A34A'
    : (changeTone ?? 0) < 0
      ? '#DC2626'
      : '#64748B'

  return (
    <Card as="section" className="coach-overall-progress">
      <CardHeader
        title="Overall Progress"
        eyebrow="All assigned trainees"
        trailing={
          <ProgressSelect
            className="progress-control-select coach-progress-period-select"
            options={PERIOD_OPTIONS}
            value={period}
            onValueChange={setPeriod}
            ariaLabel="Overall progress period"
          />
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <LoadingState label="Loading overall progress..." />
      ) : overview ? (
        <div className="coach-overall-stats">
          <StatCard
            label="Completed Workouts"
            value={String(overview.completedWorkouts.current)}
            detail={comparisonDetail(overview)}
            icon={<Dumbbell size={19} />}
            accent={workoutAccent}
          />
          <StatCard
            label="Personal Records"
            value={String(overview.personalRecords)}
            detail={`Achieved this ${periodLabel(overview.period)}`}
            icon={<Trophy size={19} />}
            accent="#EAB308"
          />
          <StatCard
            label="Goals Achieved"
            value={String(overview.goalsAchieved)}
            detail={`Completed this ${periodLabel(overview.period)}`}
            icon={<Target size={19} />}
            accent="#2563EB"
          />
        </div>
      ) : null}
    </Card>
  )
}
