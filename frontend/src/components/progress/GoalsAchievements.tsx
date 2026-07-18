import { FormEvent, useEffect, useState } from 'react'
import { Archive, Award, Plus, Target, Trophy, X } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  CardHeader,
  EmptyState,
  FormField,
  Input,
  LoadingState,
  Select,
} from '@gymbro/ui-kit'
import type { SelectOption } from '@gymbro/ui-kit'
import {
  AchievementUnlock,
  createGoal,
  listAchievements,
  listGoals,
  ProgressGoal,
  ProgressGoalType,
  updateGoal,
} from '../../api/progress.api'

const GOAL_TYPES: SelectOption<ProgressGoalType>[] = [
  { value: 'weekly_workouts', label: 'Weekly workouts' },
  { value: 'exercise_strength', label: 'Exercise strength' },
  { value: 'body_weight', label: 'Body weight' },
  { value: 'muscle_mass', label: 'Muscle mass' },
]

const goalLabel = (goal: ProgressGoal) => {
  if (goal.type === 'weekly_workouts') return 'Weekly workouts'
  if (goal.type === 'exercise_strength') return `${goal.exerciseName} strength`
  if (goal.type === 'body_weight') return 'Body weight'
  return 'Muscle mass'
}

const achievementLabel = (achievement: AchievementUnlock) => {
  if (achievement.category === 'workout_count') return `${achievement.value} workouts completed`
  if (achievement.category === 'streak') return `${achievement.value}-day workout streak`
  return achievement.exerciseName
    ? `${achievement.exerciseName} personal record`
    : 'New personal record'
}

interface GoalsAchievementsProps {
  exercises: string[]
}

export default function GoalsAchievements({ exercises }: GoalsAchievementsProps) {
  const [goals, setGoals] = useState<ProgressGoal[]>([])
  const [achievements, setAchievements] = useState<AchievementUnlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [goalType, setGoalType] = useState<ProgressGoalType>('weekly_workouts')
  const [exerciseName, setExerciseName] = useState('')
  const [baselineValue, setBaselineValue] = useState('')
  const [targetValue, setTargetValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([listGoals('active'), listAchievements(undefined, 8)])
      .then(([goalResponse, achievementResponse]) => {
        setGoals(goalResponse.data)
        setAchievements(achievementResponse.data)
      })
      .catch(() => setError('Could not load goals and achievements.'))
      .finally(() => setLoading(false))
  }, [])

  const exerciseOptions: SelectOption[] = exercises.map(name => ({ value: name, label: name }))
  const unit = goalType === 'weekly_workouts' ? 'workouts' : 'kg'

  const resetForm = () => {
    setShowForm(false)
    setGoalType('weekly_workouts')
    setExerciseName('')
    setBaselineValue('')
    setTargetValue('')
    setError('')
  }

  const submitGoal = async (event: FormEvent) => {
    event.preventDefault()
    const target = Number(targetValue)
    if (!Number.isFinite(target) || target <= 0) {
      setError('Enter a target greater than zero.')
      return
    }
    if (goalType === 'weekly_workouts' && !Number.isInteger(target)) {
      setError('Weekly workouts must be a whole number.')
      return
    }
    if (goalType === 'exercise_strength' && !exerciseName) {
      setError('Choose an exercise for this goal.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await createGoal({
        type: goalType,
        targetValue: target,
        ...(exerciseName ? { exerciseName } : {}),
        ...(baselineValue ? { baselineValue: Number(baselineValue) } : {}),
      })
      const { data } = await listGoals('active')
      setGoals(data)
      resetForm()
    } catch {
      setError('Could not create this goal. Please check the values and try again.')
    } finally {
      setSaving(false)
    }
  }

  const archiveGoal = async (goal: ProgressGoal) => {
    try {
      await updateGoal(goal._id, { status: 'archived' })
      setGoals(current => current.filter(item => item._id !== goal._id))
    } catch {
      setError('Could not archive this goal.')
    }
  }

  if (loading) return <LoadingState label="Loading goals and achievements..." />

  return (
    <div className="goals-achievements-grid">
      <Card as="section" className="progress-card">
        <CardHeader
          title="Goals"
          trailing={
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={showForm ? <X size={16} /> : <Plus size={16} />}
              onClick={() => showForm ? resetForm() : setShowForm(true)}
            >
              {showForm ? 'Cancel' : 'Add goal'}
            </Button>
          }
        />

        {error && <Alert variant="error">{error}</Alert>}

        {showForm && (
          <form className="goal-form" onSubmit={submitGoal}>
            <FormField label="Goal type">
              <Select options={GOAL_TYPES} value={goalType} onValueChange={setGoalType} />
            </FormField>
            {goalType === 'exercise_strength' && (
              <FormField label="Exercise">
                <Select
                  options={exerciseOptions}
                  value={exerciseName}
                  placeholder="Choose exercise"
                  onValueChange={setExerciseName}
                  required
                />
              </FormField>
            )}
            {goalType !== 'weekly_workouts' && (
              <FormField label={`Starting value (${unit})`} hint="Optional">
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={baselineValue}
                  onChange={event => setBaselineValue(event.target.value)}
                />
              </FormField>
            )}
            <FormField label={`Target (${unit})`}>
              <Input
                type="number"
                min="0.1"
                step={goalType === 'weekly_workouts' ? '1' : '0.1'}
                value={targetValue}
                onChange={event => setTargetValue(event.target.value)}
                required
              />
            </FormField>
            <Button type="submit" size="sm" loading={saving} loadingLabel="Saving...">
              Save goal
            </Button>
          </form>
        )}

        {goals.length === 0 ? (
          <EmptyState>No active goals yet.</EmptyState>
        ) : (
          <ul className="goal-list">
            {goals.map(goal => {
              const percent = Math.max(0, Math.min(goal.progressPercent ?? 0, 100))
              return (
                <li key={goal._id} className="goal-row">
                  <span className="goal-icon"><Target size={17} aria-hidden="true" /></span>
                  <div className="goal-content">
                    <div className="goal-heading">
                      <strong>{goalLabel(goal)}</strong>
                      <span>{goal.currentValue ?? '--'} / {goal.targetValue} {goal.unit}</span>
                    </div>
                    <div className="goal-track" aria-label={`${Math.round(percent)} percent complete`}>
                      <span style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="goal-archive-button"
                    onClick={() => archiveGoal(goal)}
                    aria-label={`Archive ${goalLabel(goal)}`}
                    title="Archive goal"
                  >
                    <Archive size={16} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card as="section" className="progress-card achievements-card">
        <CardHeader title="Achievements" trailing={<Award size={18} aria-hidden="true" />} />
        {achievements.length === 0 ? (
          <EmptyState>No achievements unlocked yet.</EmptyState>
        ) : (
          <ul className="achievement-list">
            {achievements.map(achievement => (
              <li key={achievement._id} className="achievement-row">
                <span className="achievement-icon"><Trophy size={18} aria-hidden="true" /></span>
                <div>
                  <strong>{achievementLabel(achievement)}</strong>
                  <span>{new Date(achievement.unlockedAt).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
