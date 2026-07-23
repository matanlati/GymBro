import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Badge, Button, Card, EmptyState, LoadingState, PageHeader } from '@gymbro/ui-kit'
import { listSessions, getOrCreateToday, Session } from '../api/sessions.api'
import { getActivePlan, WorkoutPlan } from '../api/plans.api'
import { useAuth } from '../context/AuthContext'
import CoachWorkoutsView from '../components/CoachWorkoutsView'

const startOfWeek = (d: Date): Date => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay()) // back to Sunday
  return x
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

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
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      listSessions().then(({ data }) => setSessions(data)),
      getActivePlan()
        .then(({ data }) => setPlan(data))
        .catch(() => setPlan(null)),
    ]).finally(() => setLoading(false))
  }, [])

  const weekStart = startOfWeek(new Date())
  const completedThisWeek = sessions.filter(
    s => s.completedAt && new Date(s.scheduledDate) >= weekStart
  ).length
  const scheduledTotal = plan?.weeklyPlan?.filter(day => !day.isArchived).length ?? 0

  const titleFor = (session: Session) =>
    session.title ?? plan?.weeklyPlan?.[session.dayIndex]?.focus ?? `Day ${session.dayIndex + 1}`

  const startNext = async () => {
    setStarting(true)
    setError('')
    try {
      const { data } = await getOrCreateToday()
      navigate(`/session/${data._id}`)
    } catch {
      setError('No active plan yet. Create one to start a workout.')
      setStarting(false)
    }
  }

  if (user?.role === 'coach') return <CoachWorkoutsView />

  return (
    <main className="workouts-page">
      <PageHeader
        title="My Workouts"
        subtitle="Track and manage your training sessions"
        actions={
          <Button onClick={() => navigate('/plans/new')}>+ New Workout</Button>
        }
      />

      {error && (
        <Alert variant="error" style={{ marginBottom: 16 }}>
          {error}
        </Alert>
      )}

      <Card as="section">
        <div className="workouts-week">
          <span>This Week</span>
          <strong>
            {completedThisWeek} completed{scheduledTotal ? ` / ${scheduledTotal} planned` : ''}
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

        <Button
          fullWidth
          loading={starting}
          loadingLabel="Starting…"
          onClick={startNext}
          style={{ marginTop: 20 }}
        >
          Start Next Workout
        </Button>
      </Card>
    </main>
  )
}

export default WorkoutsPage
