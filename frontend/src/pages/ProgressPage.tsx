import { useEffect, useMemo, useState } from 'react'
import { Alert, Card, CardHeader, EmptyState, LoadingState, PageHeader, Select } from '@gymbro/ui-kit'
import type { SelectOption } from '@gymbro/ui-kit'
import { CalendarDays, Dumbbell, Flame, Timer, TrendingDown, TrendingUp, Trophy } from 'lucide-react'
import {
  getSummary,
  getExerciseSeries,
  ProgressSummary,
  ExercisePoint,
} from '../api/progress.api'
import StatCard from '../components/progress/StatCard'
import BarChart from '../components/progress/BarChart'
import LineChart from '../components/progress/LineChart'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export default function ProgressPage() {
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [series, setSeries] = useState<ExercisePoint[]>([])
  const [seriesLoading, setSeriesLoading] = useState(false)

  // Load the summary once on mount.
  useEffect(() => {
    getSummary()
      .then(({ data }) => {
        setSummary(data)
        if (data.strengthProgress.length > 0) {
          setSelectedExercise(data.strengthProgress[0].exerciseName)
        }
      })
      .catch(() => setError('Could not load your progress. Please try again.'))
      .finally(() => setLoading(false))
  }, [])

  // Re-fetch the time-series whenever the selected exercise changes.
  useEffect(() => {
    if (!selectedExercise) return
    setSeriesLoading(true)
    getExerciseSeries(selectedExercise)
      .then(({ data }) => setSeries(data))
      .catch(() => setSeries([]))
      .finally(() => setSeriesLoading(false))
  }, [selectedExercise])

  const linePoints = useMemo(
    () => series.map(p => ({
      label: formatDate(p.date),
      value: Math.round(p.estimatedOneRepMaxKg * 10) / 10,
    })),
    [series]
  )

  const weeklyBars = useMemo(
    () =>
      (summary?.weeklyActivity ?? []).map(week => ({
        label: new Date(`${week.weekStart}T12:00:00`).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        value: week.workoutCount,
      })),
    [summary]
  )

  if (loading) {
    return <main className="progress-page"><LoadingState label="Loading your progress..." /></main>
  }

  if (error) {
    return <main className="progress-page"><Alert variant="error">{error}</Alert></main>
  }

  const hasData = (summary?.totalSessions ?? 0) > 0
  const exerciseOptions: SelectOption[] = (summary?.strengthProgress ?? []).map(item => ({
    value: item.exerciseName,
    label: item.exerciseName,
  }))
  const selectedStrength = summary?.strengthProgress.find(
    item => item.exerciseName === selectedExercise
  )

  return (
    <main className="progress-page">
      <PageHeader
        title="Your Progress"
        subtitle="Track your fitness journey and celebrate achievements"
      />

      {!hasData && (
        <EmptyState>Complete a workout to start seeing your progress here.</EmptyState>
      )}

      {hasData && summary && (
        <>
          <section className="progress-stats">
            <StatCard
              label="Total Workouts"
              value={String(summary.totalSessions)}
              detail="Completed sessions"
              icon={<Dumbbell size={19} />}
              accent="#F97316"
            />
            <StatCard
              label="Average Duration"
              value={`${summary.averageDurationMinutes} min`}
              detail="Per workout"
              icon={<Timer size={19} />}
              accent="#3B82F6"
            />
            <StatCard
              label="Personal Records"
              value={String(summary.personalRecords.length + summary.bodyweightRecords.length)}
              detail="Weight and rep records"
              icon={<Trophy size={19} />}
              accent="#EAB308"
            />
            <StatCard
              label="Current Streak"
              value={`${summary.currentStreakDays} days`}
              detail={`Best: ${summary.bestStreakDays} days`}
              icon={<Flame size={19} />}
              accent="#22C55E"
            />
          </section>

          <Card as="section" className="progress-card progress-activity-card">
            <CardHeader title="Weekly Activity" trailing={<CalendarDays size={18} aria-hidden="true" />} />
            <BarChart
              data={weeklyBars}
              barColor="#F97316"
              emptyText="Complete a workout to start your weekly activity history."
            />
          </Card>

          <div className="progress-grid">
            <Card as="section" className="progress-card">
              <CardHeader
                title="Strength Progress"
                trailing={
                  exerciseOptions.length > 0 ? (
                    <Select
                      className="progress-select"
                      options={exerciseOptions}
                      value={selectedExercise}
                      onValueChange={setSelectedExercise}
                      aria-label="Select exercise"
                    />
                  ) : undefined
                }
              />
              {selectedStrength && (
                <div className="strength-summary" aria-label={`${selectedExercise} strength summary`}>
                  <div>
                    <span className="strength-summary-label">Estimated 1RM</span>
                    <strong>{selectedStrength.currentEstimatedOneRepMaxKg} kg</strong>
                  </div>
                  <div className={`strength-summary-change${selectedStrength.improvementPercent < 0 ? ' is-negative' : ''}`}>
                    {selectedStrength.improvementPercent < 0
                      ? <TrendingDown size={16} aria-hidden="true" />
                      : <TrendingUp size={16} aria-hidden="true" />}
                    <span>
                      {selectedStrength.improvementPercent >= 0 ? '+' : ''}
                      {selectedStrength.improvementPercent}%
                    </span>
                  </div>
                </div>
              )}
              {seriesLoading ? (
                <LoadingState />
              ) : (
                <LineChart
                  data={linePoints}
                  unit="kg estimated 1RM"
                  emptyText="Complete this exercise in two workouts to see its strength trend."
                />
              )}
            </Card>

            <Card as="section" className="progress-card">
              <CardHeader title="Bodyweight Records" />
              {summary.bodyweightRecords.length === 0 ? (
                <EmptyState>No bodyweight records yet.</EmptyState>
              ) : (
                <ul className="bodyweight-record-list">
                  {summary.bodyweightRecords.map(record => (
                    <li key={record.exerciseKey} className="bodyweight-record-row">
                      <span className="bodyweight-record-icon">
                        <Dumbbell size={17} aria-hidden="true" />
                      </span>
                      <span className="bodyweight-record-name">{record.exerciseName}</span>
                      <strong>{record.maxReps} reps</strong>
                      <span className="bodyweight-record-date">{formatDate(record.achievedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card as="section" className="progress-card">
            <CardHeader title="Records by Exercise" />
            {summary.personalRecords.length === 0 ? (
              <EmptyState>No personal records yet.</EmptyState>
            ) : (
              <ul className="progress-pr-list">
                {summary.personalRecords.map(pr => (
                  <li key={pr.exerciseName} className="progress-pr-row">
                    <span className="progress-pr-name">{pr.exerciseName}</span>
                    <span className="progress-pr-weight">{pr.maxWeightKg} kg</span>
                    <span className="progress-pr-date">{formatDate(pr.achievedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </main>
  )
}
