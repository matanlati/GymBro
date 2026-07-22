import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, EmptyState, FormField, Input, LoadingState, PageHeader, Textarea } from '@gymbro/ui-kit'
import { Dumbbell, History, Pencil, Plus, Trash2, UserRound, X } from 'lucide-react'
import { AxiosError } from 'axios'
import {
  CoachManagedWorkoutSession,
  CoachTraineeWorkouts,
  CoachUser,
  CoachWorkoutTypeInput,
  createCoachTraineeWorkoutType,
  getCoachTraineeWorkouts,
  listCoachTrainees,
  updateCoachTraineeWorkoutType,
} from '../api/coach.api'

type ViewMode = 'overview' | 'sessions'
type WorkoutEditor = CoachWorkoutTypeInput & { dayIndex: number | null }

const blankExercise = () => ({ name: '', sets: '3', reps: '8-12', notes: '' })

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
  const [editor, setEditor] = useState<WorkoutEditor | null>(null)
  const [editorError, setEditorError] = useState('')
  const [saving, setSaving] = useState(false)

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

  const openCreate = () => {
    setEditorError('')
    setEditor({ dayIndex: null, name: '', exercises: [blankExercise()] })
  }

  const openEdit = (dayIndex: number) => {
    const workout = data?.plan?.weeklyPlan[dayIndex]
    if (!workout) return
    setEditorError('')
    setEditor({
      dayIndex,
      name: workout.focus,
      exercises: workout.exercises.map(exercise => ({ ...exercise })),
    })
  }

  const updateExercise = (index: number, field: keyof WorkoutEditor['exercises'][number], value: string) => {
    setEditor(current => current ? {
      ...current,
      exercises: current.exercises.map((exercise, exerciseIndex) => exerciseIndex === index ? { ...exercise, [field]: value } : exercise),
    } : current)
  }

  const saveWorkout = async (event: FormEvent) => {
    event.preventDefault()
    if (!editor || !selectedId) return
    setSaving(true)
    setEditorError('')
    try {
      const payload = { name: editor.name, exercises: editor.exercises }
      const response = editor.dayIndex === null
        ? await createCoachTraineeWorkoutType(selectedId, payload)
        : await updateCoachTraineeWorkoutType(selectedId, editor.dayIndex, payload)
      setData(current => current ? { ...current, plan: response.data } : { plan: response.data, sessions: [] })
      setEditor(null)
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>
      setEditorError(axiosError.response?.data?.message ?? 'Could not save this workout type.')
    } finally {
      setSaving(false)
    }
  }

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
            <Button leadingIcon={<Plus size={16} />} onClick={openCreate}>Create Workout Type</Button>
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
                      <Button variant="ghost" size="sm" leadingIcon={<Pencil size={14} />} onClick={() => openEdit(dayIndex)}>Edit</Button>
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

      {editor ? (
        <div className="coach-modal-backdrop" role="presentation" onClick={() => !saving && setEditor(null)}>
          <section className="coach-modal coach-workout-editor-modal" role="dialog" aria-modal="true" aria-labelledby="workout-editor-title" onClick={event => event.stopPropagation()}>
            <div className="coach-modal-head">
              <div>
                <h2 id="workout-editor-title">{editor.dayIndex === null ? 'Create workout type' : 'Edit workout type'}</h2>
                <p>Changes affect future sessions. Previous trainee logs stay unchanged.</p>
              </div>
              <button type="button" aria-label="Close workout editor" onClick={() => !saving && setEditor(null)}><X size={18} /></button>
            </div>
            <form className="coach-workout-editor-form" onSubmit={saveWorkout}>
              <FormField label="Workout name">
                <Input value={editor.name} maxLength={100} placeholder="Upper Body Strength" required onChange={event => setEditor(current => current ? { ...current, name: event.target.value } : current)} />
              </FormField>

              <div className="coach-workout-editor-exercises-head">
                <div><h3>Exercises</h3><p>Set the prescription the trainee will see.</p></div>
                <Button type="button" variant="secondary" size="sm" leadingIcon={<Plus size={14} />} onClick={() => setEditor(current => current ? { ...current, exercises: [...current.exercises, blankExercise()] } : current)}>Add Exercise</Button>
              </div>

              <div className="coach-workout-editor-exercises">
                {editor.exercises.map((exercise, index) => (
                  <div className="coach-workout-editor-exercise" key={index}>
                    <span className="coach-workout-editor-number">{index + 1}</span>
                    <div className="coach-workout-editor-fields">
                      <FormField label="Exercise">
                        <Input value={exercise.name} maxLength={120} required placeholder="Bench Press" onChange={event => updateExercise(index, 'name', event.target.value)} />
                      </FormField>
                      <FormField label="Sets">
                        <Input value={exercise.sets} maxLength={30} required placeholder="3" onChange={event => updateExercise(index, 'sets', event.target.value)} />
                      </FormField>
                      <FormField label="Reps">
                        <Input value={exercise.reps} maxLength={30} required placeholder="8-12" onChange={event => updateExercise(index, 'reps', event.target.value)} />
                      </FormField>
                      <FormField label="Coach notes" style={{ gridColumn: '1 / -1' }}>
                        <Textarea value={exercise.notes ?? ''} maxLength={500} rows={2} placeholder="Optional form or progression guidance" onChange={event => updateExercise(index, 'notes', event.target.value)} />
                      </FormField>
                    </div>
                    <button className="coach-workout-editor-remove" type="button" aria-label={`Remove exercise ${index + 1}`} disabled={editor.exercises.length === 1} onClick={() => setEditor(current => current ? { ...current, exercises: current.exercises.filter((_, exerciseIndex) => exerciseIndex !== index) } : current)}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
              {editorError && <Alert variant="error">{editorError}</Alert>}
              <div className="coach-modal-actions">
                <Button type="button" variant="secondary" disabled={saving} onClick={() => setEditor(null)}>Cancel</Button>
                <Button type="submit" loading={saving} loadingLabel="Saving...">{editor.dayIndex === null ? 'Create Workout' : 'Save Changes'}</Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  )
}
