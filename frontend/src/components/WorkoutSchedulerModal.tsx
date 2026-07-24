import { useMemo, useState } from 'react'
import { Alert, Button } from '@gymbro/ui-kit'
import { CalendarDays, X } from 'lucide-react'
import { WorkoutPlan } from '../api/plans.api'
import { scheduleSession, Session } from '../api/sessions.api'

type Props = {
  plan: WorkoutPlan
  sessions: Session[]
  initialDate?: Date
  initialDayIndex?: number
  onClose: () => void
  onScheduled: (session: Session) => void
}

const startOfDay = (date: Date) => {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

const dateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function WorkoutSchedulerModal({ plan, sessions, initialDate, initialDayIndex, onClose, onScheduled }: Props) {
  const activeTypes = plan.weeklyPlan
    .map((workout, dayIndex) => ({ workout, dayIndex }))
    .filter(item => !item.workout.isArchived)
  const tomorrow = startOfDay(new Date())
  tomorrow.setDate(tomorrow.getDate() + 1)
  const requestedStart = initialDate ? startOfDay(initialDate) : tomorrow
  const rangeStart = requestedStart < tomorrow ? tomorrow : requestedStart
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(rangeStart)
    date.setDate(date.getDate() + index)
    return date
  })
  const [selectedDate, setSelectedDate] = useState(dateKey(rangeStart))
  const validInitialType = activeTypes.some(item => item.dayIndex === initialDayIndex)
  const [selectedType, setSelectedType] = useState(validInitialType ? String(initialDayIndex) : String(activeTypes[0]?.dayIndex ?? 'other'))
  const [customName, setCustomName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const plannedByDate = useMemo(() => sessions.reduce<Record<string, Session[]>>((grouped, session) => {
    if (!session.completedAt) {
      const key = dateKey(new Date(session.scheduledDate))
      grouped[key] = [...(grouped[key] ?? []), session]
    }
    return grouped
  }, {}), [sessions])

  const submit = async () => {
    if (selectedType === 'other' && !customName.trim()) {
      setError('Add a name for the custom workout.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { data } = await scheduleSession(selectedType === 'other'
        ? { scheduledDate: selectedDate, title: customName.trim() }
        : { scheduledDate: selectedDate, dayIndex: Number(selectedType) })
      onScheduled(data)
    } catch {
      setError('Could not schedule this workout. Please try another date.')
      setSaving(false)
    }
  }

  return (
    <div className="coach-modal-backdrop workout-planner-backdrop" role="presentation" onClick={() => !saving && onClose()}>
      <section className="coach-modal workout-planner-modal" role="dialog" aria-modal="true" aria-labelledby="workout-planner-title" onClick={event => event.stopPropagation()}>
        <div className="coach-modal-head">
          <div><h2 id="workout-planner-title">Plan a Workout</h2><p>Choose a day and a workout from your active plan.</p></div>
          <button type="button" aria-label="Close workout planner" disabled={saving} onClick={onClose}><X size={17} /></button>
        </div>

        <div className="workout-planner-week">
          {days.map(date => {
            const key = dateKey(date)
            const planned = plannedByDate[key] ?? []
            return (
              <button type="button" className={selectedDate === key ? 'active' : ''} key={key} onClick={() => setSelectedDate(key)}>
                <span>{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <strong>{date.getDate()}</strong>
                <small>{planned.length ? `${planned.length} planned` : date.toLocaleDateString('en-US', { month: 'short' })}</small>
              </button>
            )
          })}
        </div>

        <div className="workout-planner-fields">
          <label>
            Workout type
            <select value={selectedType} onChange={event => setSelectedType(event.target.value)}>
              {activeTypes.map(({ workout, dayIndex }) => <option value={dayIndex} key={`${dayIndex}-${workout.focus}`}>{workout.focus}</option>)}
              <option value="other">Other activity</option>
            </select>
          </label>
          {selectedType === 'other' && (
            <label>
              Workout name
              <input value={customName} maxLength={100} placeholder="Recovery run, yoga, mobility..." onChange={event => setCustomName(event.target.value)} />
            </label>
          )}
          {(plannedByDate[selectedDate]?.length ?? 0) > 0 && (
            <div className="workout-planner-existing"><CalendarDays size={15} /><span>{plannedByDate[selectedDate].length} workout{plannedByDate[selectedDate].length === 1 ? '' : 's'} already planned for this day.</span></div>
          )}
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        <div className="coach-modal-actions">
          <Button variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button loading={saving} loadingLabel="Scheduling..." onClick={submit}>Schedule Workout</Button>
        </div>
      </section>
    </div>
  )
}
