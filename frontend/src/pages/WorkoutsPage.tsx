import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listSessions, getOrCreateToday, Session } from '../api/sessions.api'
import { getActivePlan, WorkoutPlan } from '../api/plans.api'

const startOfWeek = (d: Date): Date => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay()) // back to Sunday
  return x
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const WorkoutsPage = () => {
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
  const scheduledTotal = plan?.weeklyPlan?.length ?? 0

  const titleFor = (session: Session) =>
    plan?.weeklyPlan?.[session.dayIndex]?.focus ?? `Day ${session.dayIndex + 1}`

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

  return (
    <main className="workouts-page">
      <header className="workouts-header">
        <div>
          <h1>My Workouts</h1>
          <p>Track and manage your training sessions</p>
        </div>
        <button type="button" className="new-workout-button" onClick={() => navigate('/plans/new')}>
          + New Workout
        </button>
      </header>

      {error && <p className="workouts-error">{error}</p>}

      <section className="workouts-panel">
        <div className="workouts-week">
          <span>This Week</span>
          <strong>
            {completedThisWeek} completed{scheduledTotal ? ` / ${scheduledTotal} planned` : ''}
          </strong>
        </div>

        {loading ? (
          <p className="workouts-empty">Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <p className="workouts-empty">No sessions yet. Start your first workout below.</p>
        ) : (
          <ul className="workouts-list">
            {sessions.map(session => {
              const done = !!session.completedAt
              return (
                <li className="workout-row" key={session._id}>
                  <div className="workout-row-main">
                    <h3>
                      {titleFor(session)}
                      {done && <span className="workout-row-badge">Completed</span>}
                    </h3>
                    <p>
                      {formatDate(session.scheduledDate)} · {session.exercises.length} exercises
                    </p>
                  </div>
                  <button
                    type="button"
                    className="workout-row-action"
                    onClick={() => navigate(`/session/${session._id}`)}
                  >
                    {done ? 'View →' : 'Start →'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <button type="button" className="workouts-start-cta" onClick={startNext} disabled={starting}>
          {starting ? 'Starting…' : 'Start Next Workout'}
        </button>
      </section>
    </main>
  )
}

export default WorkoutsPage
