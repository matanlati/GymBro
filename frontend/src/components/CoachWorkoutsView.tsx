import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, EmptyState, LoadingState, PageHeader } from '@gymbro/ui-kit'
import { Dumbbell, History, Pencil, Plus, UserRound } from 'lucide-react'
import {
  CoachManagedWorkoutSession,
  CoachTraineeWorkouts,
  CoachUser,
  getCoachTraineeWorkouts,
  listCoachTrainees,
} from '../api/coach.api'

type ViewMode = 'overview' | 'sessions'

const formatDate = (value: string) => new Date(value).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric',
})

export default function CoachWorkoutsView() {
  const [trainees, setTrainees] = useState<CoachUser[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [data, setData] = useState<CoachTraineeWorkouts | null>(null)
  const [views, setViews] = useState<Record<number, ViewMode>>({})
  const [loadingTrainees, setLoadingTrainees] = useState(true)
  const [loadingWorkouts, setLoadingWorkouts] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listCoachTrainees()
      .then(({ data: items }) => {
        setTrainees(items)
        setSelectedId(items[0]?._id ?? '')
      })
      .catch(() => setError('Could not load your trainees.'))
      .finally(() => setLoadingTrainees(false))
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setData(null)
      return
    }
    setLoadingWorkouts(true)
    setError('')
    getCoachTraineeWorkouts(selectedId)
      .then(({ data: result }) => setData(result))
      .catch(() => setError('Could not load this trainee’s workouts.'))
      .finally(() => setLoadingWorkouts(false))
  }, [selectedId])

  const selectedTrainee = trainees.find(trainee => trainee._id === selectedId)
  const sessionsByDay = useMemo(() => {
    const grouped = new Map<number, CoachManagedWorkoutSession[]>()
    data?.sessions.forEach(session => grouped.set(session.dayIndex, [...(grouped.get(session.dayIndex) ?? []), session]))
    return grouped
  }, [data])

  return (
    <main className="coach-workouts-page">
      <PageHeader title="Trainee Workouts" subtitle="Review and manage each trainee’s workout program" />

      <Card className="coach-workout-trainee-picker">
        <div>
          <UserRound size={20} />
          <div><strong>Select a trainee</strong><span>Choose whose workout program you want to view.</span></div>
        </div>
        {loadingTrainees ? <span>Loading...</span> : (
          <select value={selectedId} onChange={event => setSelectedId(event.target.value)} disabled={!trainees.length}>
            {!trainees.length && <option value="">No trainees available</option>}
            {trainees.map(trainee => <option value={trainee._id} key={trainee._id}>{trainee.name} · {trainee.email}</option>)}
          </select>
        )}
      </Card>

      {error && <Alert variant="error">{error}</Alert>}
      {loadingWorkouts ? <LoadingState label="Loading workout program..." /> : !selectedId ? (
        <Card><EmptyState>Add a trainee before creating workout types.</EmptyState></Card>
      ) : (
        <>
          <div className="coach-workout-program-head">
            <div>
              <span>{selectedTrainee?.name}</span>
              <h2>{data?.plan?.title ?? 'No active workout plan'}</h2>
              <p>{data?.plan?.summary ?? 'Create the first workout type for this trainee.'}</p>
            </div>
            <Button leadingIcon={<Plus size={16} />}>Create Workout Type</Button>
          </div>

          {!data?.plan?.weeklyPlan.length ? (
            <Card><EmptyState>No workout types yet. Create one to build this trainee’s program.</EmptyState></Card>
          ) : (
            <div className="coach-workout-type-grid">
              {data.plan.weeklyPlan.map((workout, dayIndex) => {
                const mode = views[dayIndex] ?? 'overview'
                const sessions = sessionsByDay.get(dayIndex) ?? []
                return (
                  <Card className="coach-workout-type-card" padding="none" key={`${dayIndex}-${workout.focus}`}>
                    <div className="coach-workout-type-head">
                      <div><span>Workout type {dayIndex + 1}</span><h3>{workout.focus}</h3></div>
                      <Button variant="ghost" size="sm" leadingIcon={<Pencil size={14} />}>Edit</Button>
                    </div>
                    <div className="coach-workout-view-tabs">
                      <button className={mode === 'overview' ? 'active' : ''} onClick={() => setViews(current => ({ ...current, [dayIndex]: 'overview' }))}><Dumbbell size={14} /> Overview</button>
                      <button className={mode === 'sessions' ? 'active' : ''} onClick={() => setViews(current => ({ ...current, [dayIndex]: 'sessions' }))}><History size={14} /> Sessions <Badge>{sessions.length}</Badge></button>
                    </div>
                    {mode === 'overview' ? (
                      <div className="coach-workout-exercise-list">
                        <div className="coach-workout-exercise-labels"><span>Exercise</span><span>Sets</span><span>Reps</span></div>
                        {workout.exercises.map((exercise, index) => (
                          <div className="coach-workout-exercise-row" key={`${exercise.name}-${index}`}>
                            <div><strong>{exercise.name}</strong>{exercise.notes && <small>{exercise.notes}</small>}</div>
                            <span>{exercise.sets}</span><span>{exercise.reps}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="coach-workout-session-list">
                        {!sessions.length ? <EmptyState>No completed sessions recorded for this workout type.</EmptyState> : sessions.map(session => (
                          <details key={session._id}>
                            <summary><div><strong>{formatDate(session.completedAt)}</strong><span>{session.exercises.length} exercises</span></div><span>View session</span></summary>
                            <div className="coach-workout-session-detail">
                              {session.exercises.map(exercise => (
                                <div key={exercise.exerciseKey ?? exercise.name}>
                                  <strong>{exercise.name}</strong>
                                  <span>{exercise.sets.length ? exercise.sets.map(set => `${set.weightUsedKg ?? 0} kg × ${set.repsCompleted}`).join(' · ') : 'No sets logged'}</span>
                                </div>
                              ))}
                              {session.notes && <p><strong>Trainee notes:</strong> {session.notes}</p>}
                            </div>
                          </details>
                        ))}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </main>
  )
}
