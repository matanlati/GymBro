import { useEffect, useMemo, useState } from 'react'
import {
  getSummary,
  getExerciseSeries,
  ProgressSummary,
  ExercisePoint,
} from '../api/progress.api'
import StatCard from '../components/progress/StatCard'
import BarChart from '../components/progress/BarChart'
import LineChart from '../components/progress/LineChart'

// ── Icons ───────────────────────────────────────────────────────────────────
const iconProps = {
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}
const CheckIcon = () => <svg {...iconProps}><path d="M20 6 9 17l-5-5" /></svg>
const FlameIcon = () => <svg {...iconProps}><path d="M12 2c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 2 2 2 0 0-2-2-2-2-4Z" /></svg>
const WeightIcon = () => <svg {...iconProps}><path d="M6.5 8a5.5 5.5 0 0 1 11 0" /><path d="M5 8h14l-2 13H7Z" /></svg>
const TrophyIcon = () => <svg {...iconProps}><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0Z" /><path d="M5 6H3a3 3 0 0 0 3 3h1" /><path d="M19 6h2a3 3 0 0 1-3 3h-1" /></svg>

const formatVolume = (kg: number): string =>
  kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${kg} kg`

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

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
        if (data.personalRecords.length > 0) {
          setSelectedExercise(data.personalRecords[0].exerciseName)
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
    () => series.map(p => ({ label: formatDate(p.date), value: p.maxWeightKg })),
    [series]
  )

  const prBars = useMemo(
    () =>
      (summary?.personalRecords ?? [])
        .slice(0, 6)
        .map(pr => ({ label: pr.exerciseName, value: pr.maxWeightKg })),
    [summary]
  )

  if (loading) {
    return <main className="progress-page"><p className="progress-empty">Loading your progress…</p></main>
  }

  if (error) {
    return <main className="progress-page"><p className="progress-error">{error}</p></main>
  }

  const hasData = (summary?.totalSessions ?? 0) > 0

  return (
    <main className="progress-page">
      <header className="progress-header">
        <h1>Your Progress</h1>
        <p>Track your fitness journey and celebrate achievements</p>
      </header>

      {!hasData && (
        <p className="progress-empty">
          Complete a workout to start seeing your progress here.
        </p>
      )}

      {hasData && summary && (
        <>
          <section className="progress-stats">
            <StatCard label="Total Workouts" value={String(summary.totalSessions)} icon={<CheckIcon />} accent="#F97316" />
            <StatCard label="Total Volume" value={formatVolume(summary.totalVolumeKg)} icon={<WeightIcon />} accent="#3B82F6" />
            <StatCard label="Personal Records" value={String(summary.personalRecords.length)} icon={<TrophyIcon />} accent="#EAB308" />
            <StatCard label="Current Streak" value={`${summary.currentStreakDays} days`} icon={<FlameIcon />} accent="#22C55E" />
          </section>

          <div className="progress-grid">
            <section className="progress-card">
              <div className="progress-card-head">
                <h2>Strength Progress</h2>
                {summary.personalRecords.length > 0 && (
                  <select
                    className="progress-select"
                    value={selectedExercise}
                    onChange={e => setSelectedExercise(e.target.value)}
                    aria-label="Select exercise"
                  >
                    {summary.personalRecords.map(pr => (
                      <option key={pr.exerciseName} value={pr.exerciseName}>
                        {pr.exerciseName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {seriesLoading ? (
                <p className="progress-empty">Loading…</p>
              ) : (
                <LineChart data={linePoints} unit="kg" />
              )}
            </section>

            <section className="progress-card">
              <div className="progress-card-head">
                <h2>Personal Records</h2>
              </div>
              <BarChart data={prBars} emptyText="Log some sets with weight to set records." />
            </section>
          </div>

          <section className="progress-card">
            <div className="progress-card-head">
              <h2>Records by Exercise</h2>
            </div>
            {summary.personalRecords.length === 0 ? (
              <p className="progress-empty">No personal records yet.</p>
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
          </section>
        </>
      )}
    </main>
  )
}
