import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Badge, Button, Card, EmptyState, LoadingState, PageHeader } from '@gymbro/ui-kit'
import { listSessions, getOrCreateToday, Session } from '../api/sessions.api'
import { getActivePlan, WorkoutPlan } from '../api/plans.api'
import { useAuth } from '../context/AuthContext'
import CoachWorkoutsView from '../components/CoachWorkoutsView'
import { Dumbbell, History, Play } from 'lucide-react'
import { getMe } from '../api/users.api'

const startOfWeek = (d: Date): Date => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay()) // back to Sunday
  return x
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const isToday = (iso: string) => {
  const date = new Date(iso)
  const today = new Date()
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
}

// FUTURE COACH-CREATED PLANS: keep every assigned plan's `_id` persistent and
// each workout slot's `dayIndex` stable across sessions. Coach progress alerts
// group generated and custom-plan workouts by `planId + dayIndex`; custom
// exercises should also receive stable `exerciseKey` values rather than relying
// on editable display names. Ad-hoc workouts use normalized titles as a fallback.

const WorkoutsPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<Session[]>([])
  const [plan, setPlan] = useState<WorkoutPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [startingDayIndex, setStartingDayIndex] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [showReplacePlanWarning, setShowReplacePlanWarning] = useState(false)
  const [showWorkoutChooser, setShowWorkoutChooser] = useState(false)
  const [selectedPlanDayIndex, setSelectedPlanDayIndex] = useState(0)
  const [hasCoach, setHasCoach] = useState(Boolean(user?.coachId))

  useEffect(() => {
    Promise.all([
      listSessions().then(({ data }) => setSessions(data)),
      getActivePlan()
        .then(({ data }) => setPlan(data))
        .catch(() => setPlan(null)),
      getMe()
        .then(({ data }) => setHasCoach(Boolean(data.coachId)))
        .catch(() => setHasCoach(Boolean(user?.coachId))),
    ]).finally(() => setLoading(false))
  }, [])

  const weekStart = startOfWeek(new Date())
  const completedWeekSessions = sessions.filter(
    s => s.completedAt && new Date(s.scheduledDate) >= weekStart
  )
  const activeWorkoutTypes = plan?.weeklyPlan
    .map((workout, dayIndex) => ({ workout, dayIndex }))
    .filter(item => !item.workout.isArchived) ?? []
  const scheduledTotal = activeWorkoutTypes.length
  const completedPlanDayIndexes = new Set(
    completedWeekSessions
      .filter(session => session.planId === plan?._id && session.dayIndex >= 0)
      .map(session => session.dayIndex)
  )
  const nextWorkout = activeWorkoutTypes.find(item => !completedPlanDayIndexes.has(item.dayIndex)) ?? activeWorkoutTypes[0]
  const selectedWorkout = activeWorkoutTypes.find(item => item.dayIndex === selectedPlanDayIndex) ?? nextWorkout
  const plannedTodayDayIndexes = new Set(
    sessions
      .filter(session => !session.completedAt && session.dayIndex >= 0 && isToday(session.scheduledDate))
      .map(session => session.dayIndex)
  )

  const titleFor = (session: Session) =>
    session.title ?? plan?.weeklyPlan?.[session.dayIndex]?.focus ?? `Day ${session.dayIndex + 1}`

  const openNewPlan = () => {
    if (hasCoach) return
    if (plan?.isActive) {
      setShowReplacePlanWarning(true)
      return
    }
    navigate('/plans/new')
  }

  const startWorkout = async (dayIndex: number) => {
    setStartingDayIndex(dayIndex)
    setError('')
    try {
      const { data } = await getOrCreateToday(dayIndex)
      navigate(`/session/${data._id}`)
    } catch {
      setError('Could not start this workout. Please try again.')
      setStartingDayIndex(null)
    }
  }

  if (user?.role === 'coach') return <CoachWorkoutsView />

  return (
    <main className="workouts-page">
      <PageHeader
        title="My Workouts"
        subtitle="Track and manage your training sessions"
        actions={
          <div className="workouts-header-actions">
            <Button
              className="start-workout-button"
              leadingIcon={<Play size={16} fill="currentColor" />}
              disabled={!plan}
              onClick={() => setShowWorkoutChooser(true)}
            >
              Start Workout
            </Button>
            <Button variant="secondary" disabled={hasCoach} title={hasCoach ? 'Your coach manages your workout plan' : undefined} onClick={openNewPlan}>+ New Workout Plan</Button>
          </div>
        }
      />

      {error && (
        <Alert variant="error" style={{ marginBottom: 16 }}>
          {error}
        </Alert>
      )}
      {hasCoach && (
        <Alert variant="info">Your workout plan is managed by your coach. Ask your coach if you would like changes to your program.</Alert>
      )}

      {loading ? null : plan && activeWorkoutTypes.length ? (
        <section className="trainee-plan-overview" aria-labelledby="active-plan-title">
          <Card className="trainee-plan-summary">
            <div className="trainee-plan-summary-main">
              <span className="trainee-plan-eyebrow">Active workout plan</span>
              <h2 id="active-plan-title">{plan.title}</h2>
              <p>{plan.summary}</p>
            </div>
            <div className="trainee-plan-progress">
              <div><span>This week</span><strong>{completedPlanDayIndexes.size} / {scheduledTotal}</strong></div>
              <div className="trainee-plan-progress-track"><span style={{ width: `${Math.min(100, (completedPlanDayIndexes.size / scheduledTotal) * 100)}%` }} /></div>
              <small>{completedPlanDayIndexes.size >= scheduledTotal ? 'Weekly plan complete' : `${scheduledTotal - completedPlanDayIndexes.size} workout${scheduledTotal - completedPlanDayIndexes.size === 1 ? '' : 's'} remaining`}</small>
            </div>
          </Card>

          <div className="trainee-plan-browser">
            <div className="trainee-workout-selector" role="tablist" aria-label="Workout types">
              {activeWorkoutTypes.map(({ workout, dayIndex }, position) => {
                const completed = completedPlanDayIndexes.has(dayIndex)
                const isNext = nextWorkout?.dayIndex === dayIndex && !completed
                const selected = selectedWorkout?.dayIndex === dayIndex
                return (
                  <button type="button" role="tab" aria-selected={selected} className={selected ? 'active' : ''} key={`${dayIndex}-${workout.focus}`} onClick={() => setSelectedPlanDayIndex(dayIndex)}>
                    <span>{position + 1}</span>
                    <div><strong>{workout.focus}</strong><small>{workout.exercises.length} exercises</small></div>
                    {completed ? <Badge tone="success">Done</Badge> : isNext ? <Badge tone="accent">Up next</Badge> : null}
                  </button>
                )
              })}
            </div>

            {selectedWorkout ? (
              <Card className="trainee-workout-preview" padding="none">
                <div className="trainee-workout-preview-head">
                  <div><span>{selectedWorkout.workout.day}</span><h3>{selectedWorkout.workout.focus}</h3><p>{selectedWorkout.workout.exercises.length} exercises in this workout</p></div>
                  <Button leadingIcon={<Play size={15} fill="currentColor" />} loading={startingDayIndex === selectedWorkout.dayIndex} loadingLabel="Starting..." onClick={() => startWorkout(selectedWorkout.dayIndex)}>Start This Workout</Button>
                </div>
                <div className="trainee-workout-exercises">
                  <div className="trainee-workout-exercise-head"><span>Exercise</span><span>Sets</span><span>Reps</span></div>
                  {selectedWorkout.workout.exercises.map((exercise, index) => (
                    <div className="trainee-workout-exercise" key={`${exercise.name}-${index}`}>
                      <span className="trainee-exercise-number">{index + 1}</span>
                      <div><strong>{exercise.name}</strong>{exercise.notes && <small><b>Coach’s note:</b> {exercise.notes}</small>}</div>
                      <span>{exercise.sets}</span><span>{exercise.reps}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>
        </section>
      ) : (
        <Card className="trainee-plan-empty">
          <EmptyState>
            <Dumbbell size={26} />
            <strong>No active workout plan</strong>
            <span>Create a plan to see your weekly workouts and exercise overview here.</span>
            {hasCoach
              ? <span>Your coach has not assigned a workout plan yet.</span>
              : <Button onClick={openNewPlan}>Create Workout Plan</Button>}
          </EmptyState>
        </Card>
      )}

      <Card as="section" className="trainee-session-history">
        <div className="trainee-session-history-title"><History size={17} /><div><h2>Session History</h2><p>Your scheduled and completed workouts</p></div></div>
        <div className="workouts-week">
          <span>This Week</span>
          <strong>
            {completedPlanDayIndexes.size} completed{scheduledTotal ? ` / ${scheduledTotal} planned` : ''}
          </strong>
        </div>

        {loading ? (
          <LoadingState label="Loading sessions…" />
        ) : sessions.length === 0 ? (
          <EmptyState>No sessions yet. Start your first workout below.</EmptyState>
        ) : (
          <ul className="workouts-list">
            {sessions.map(session => {
              const done = !!session.completedAt
              return (
                <li className="workout-row" key={session._id}>
                  <div className="workout-row-main">
                    <h3>
                      {titleFor(session)}
                      {done && <Badge tone="success">Completed</Badge>}
                    </h3>
                    <p>
                      {formatDate(session.scheduledDate)} · {session.exercises.length} exercises
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/session/${session._id}`)}
                  >
                    {done ? 'View →' : 'Start →'}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}

      </Card>

      {showWorkoutChooser && plan ? (
        <div className="coach-modal-backdrop" role="presentation" onClick={() => startingDayIndex === null && setShowWorkoutChooser(false)}>
          <section
            className="coach-modal workout-chooser-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="choose-workout-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="coach-modal-head">
              <div>
                <h2 id="choose-workout-title">Which workout do you want to start?</h2>
                <p>Choose one from your active workout plan.</p>
              </div>
            </div>
            <div className="workout-chooser-options">
              {plan.weeklyPlan.map((workout, dayIndex) => workout.isArchived ? null : (
                <button
                  type="button"
                  className={plannedTodayDayIndexes.has(dayIndex) ? 'recommended' : undefined}
                  key={`${dayIndex}-${workout.focus}`}
                  disabled={startingDayIndex !== null}
                  onClick={() => startWorkout(dayIndex)}
                >
                  <span>
                    <strong>
                      {workout.focus}
                      {plannedTodayDayIndexes.has(dayIndex) ? <em>Planned today</em> : null}
                    </strong>
                    <small>{workout.day} · {workout.exercises.length} exercises</small>
                  </span>
                  <b>{startingDayIndex === dayIndex ? 'Starting…' : 'Start →'}</b>
                </button>
              ))}
            </div>
            <div className="coach-modal-actions">
              <Button variant="secondary" disabled={startingDayIndex !== null} onClick={() => setShowWorkoutChooser(false)}>Cancel</Button>
            </div>
          </section>
        </div>
      ) : null}

      {showReplacePlanWarning ? (
        <div className="coach-modal-backdrop" role="presentation" onClick={() => setShowReplacePlanWarning(false)}>
          <section
            className="coach-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="replace-plan-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="coach-modal-head">
              <div>
                <h2 id="replace-plan-title">Create a new workout plan?</h2>
                <p>Your current active plan will be deleted when the new plan is successfully created. Completed workout history and progress will remain available.</p>
              </div>
            </div>
            <div className="coach-modal-actions">
              <Button variant="secondary" onClick={() => setShowReplacePlanWarning(false)}>Cancel</Button>
              <Button onClick={() => navigate('/plans/new')}>Continue</Button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

export default WorkoutsPage
