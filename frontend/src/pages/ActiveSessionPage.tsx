import { useEffect, useState, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Badge, Button, Card, Input, LoadingState, PageHeader } from '@gymbro/ui-kit'
import {
  getSession,
  logSet,
  completeSession,
  Session,
  ExerciseLog,
  PersonalBestAchievement,
} from '../api/sessions.api'

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''

const ExerciseRow = ({
  exercise,
  index,
  disabled,
  onLog,
}: {
  exercise: ExerciseLog
  index: number
  disabled: boolean
  onLog: (exerciseIndex: number, reps: number, weight?: number) => Promise<void>
}) => {
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const duration = exercise.prescribedDurationMinutes

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const repsNum = Number(reps)
    if (!Number.isFinite(repsNum) || repsNum < 0) return
    setSubmitting(true)
    try {
      await onLog(index, repsNum, weight === '' ? undefined : Number(weight))
      setReps('')
      setWeight('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card as="article">
      <div className="session-exercise-head">
        <h3>{exercise.name}</h3>
        <span className="session-prescribed">
          {duration ? `${duration} min` : `${exercise.prescribedSets} × ${exercise.prescribedReps}`}
          {!duration && exercise.prescribedWeightKg ? ` @ ${exercise.prescribedWeightKg}kg` : ''}
        </span>
      </div>

      {exercise.coachNotes && (
        <div className="session-coach-note">
          <strong>Coach’s note</strong>
          <span>{exercise.coachNotes}</span>
        </div>
      )}

      {exercise.sets.length > 0 && (
        <div className="session-sets">
          {exercise.sets.map(set => (
            <Badge tone="accent" key={set.setNumber}>
              Set {set.setNumber}: {set.repsCompleted} reps
              {set.weightUsedKg !== undefined ? ` · ${set.weightUsedKg}kg` : ''}
            </Badge>
          ))}
        </div>
      )}

      {!disabled && !duration && (
        <form className="session-log-form" onSubmit={submit}>
          <Input
            type="number"
            min="0"
            placeholder="Reps"
            aria-label="Reps completed"
            value={reps}
            onChange={e => setReps(e.target.value)}
            required
          />
          <Input
            type="number"
            min="0"
            step="0.5"
            placeholder="Weight (kg)"
            aria-label="Weight used in kg"
            value={weight}
            onChange={e => setWeight(e.target.value)}
          />
          <Button type="submit" variant="solid" loading={submitting} loadingLabel="Logging…">
            Log Set
          </Button>
        </form>
      )}
    </Card>
  )
}

const ActiveSessionPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [sharePrompt, setSharePrompt] = useState<PersonalBestAchievement[] | null>(null)

  useEffect(() => {
    if (!id) return
    getSession(id)
      .then(({ data }) => setSession(data))
      .catch(() => setError('Could not load this workout session.'))
      .finally(() => setLoading(false))
  }, [id])

  const isComplete = !!session?.completedAt

  const handleLog = async (exerciseIndex: number, reps: number, weight?: number) => {
    if (!id) return
    const { data } = await logSet(id, exerciseIndex, { repsCompleted: reps, weightUsedKg: weight })
    setSession(data)
  }

  const handleFinish = async () => {
    if (!id) return
    setFinishing(true)
    try {
      const { data } = await completeSession(id)
      setSession(data.session)
      if (data.achievements.length > 0) {
        setSharePrompt(data.achievements)
        setFinishing(false)
      } else {
        navigate('/workouts')
      }
    } catch {
      setError('Could not finish the workout. Please try again.')
      setFinishing(false)
    }
  }

  if (loading) return <main className="session-page"><LoadingState label="Loading workout…" /></main>
  if (error && !session) return <main className="session-page"><Alert variant="error">{error}</Alert></main>
  if (!session) return null

  return (
    <main className="session-page">
      <PageHeader
        title="Workout Session"
        subtitle={`${formatDate(session.scheduledDate)} · ${session.exercises.length} exercises`}
        actions={isComplete ? <Badge tone="success">Completed</Badge> : undefined}
      />

      {error && (
        <Alert variant="error" style={{ marginBottom: 16 }}>
          {error}
        </Alert>
      )}

      <div className="session-exercises">
        {session.exercises.map((exercise, index) => (
          <ExerciseRow
            key={`${exercise.name}-${index}`}
            exercise={exercise}
            index={index}
            disabled={isComplete}
            onLog={handleLog}
          />
        ))}
      </div>

      {!isComplete && (
        <footer className="session-footer">
          <Button
            size="lg"
            fullWidth
            loading={finishing}
            loadingLabel="Finishing…"
            onClick={handleFinish}
          >
            Finish Workout
          </Button>
        </footer>
      )}

      {sharePrompt ? (
        <div className="pb-modal-backdrop" role="presentation">
          <section className="pb-share-modal" role="dialog" aria-modal="true" aria-label="Personal best achieved">
            <h2>Good job!</h2>
            <p>
              A PB was achieved on exercise {sharePrompt[0].exerciseName}
              {sharePrompt.length > 1 ? ` and ${sharePrompt.length - 1} more` : ''}.
            </p>
            <span>Would you like to share it with your friends?</span>
            <div className="pb-share-actions">
              <Button variant="secondary" onClick={() => navigate('/workouts')}>Not now</Button>
              <Button
                onClick={() => navigate('/feed', {
                  state: {
                    openComposer: true,
                    sessionId: session._id,
                    caption: `New PB on ${sharePrompt[0].exerciseName}!`,
                  },
                })}
              >
                Share
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

export default ActiveSessionPage
