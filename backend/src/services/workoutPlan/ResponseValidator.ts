import { WorkoutPlan } from '../../types'

type RawWorkoutPlan = Partial<WorkoutPlan> & {
  weeklyPlan?: Array<{
    day?: unknown
    focus?: unknown
    exercises?: Array<{
      name?: unknown
      sets?: unknown
      reps?: unknown
      durationMinutes?: unknown
      notes?: unknown
    }>
  }>
}

function requiredString(value: unknown, path: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim()) return value
  throw new Error(`${path} must be a non-empty string`)
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim()) return value
  throw new Error(`${path} must be a non-empty string when provided`)
}

export class ResponseValidator {
  static validate(response: string): WorkoutPlan {
    try {
      console.error('ResponseValidator input length:', response.length)
      console.error('ResponseValidator input preview:', response.slice(0, 100))
      console.error('ResponseValidator input end preview:', response.slice(-100))

      const parsed = JSON.parse(response) as RawWorkoutPlan

      if (!parsed.summary || !parsed.weeklyPlan || !parsed.safetyNotes || !parsed.progressionNotes) {
        throw new Error('Missing required fields')
      }
      if (!Array.isArray(parsed.weeklyPlan)) throw new Error('weeklyPlan must be an array')

      const plan: WorkoutPlan = {
        summary: requiredString(parsed.summary, 'summary'),
        weeklyPlan: parsed.weeklyPlan.map((day, dayIndex) => {
          if (!Array.isArray(day.exercises)) {
            throw new Error(`weeklyPlan[${dayIndex}].exercises must be an array`)
          }
          return {
            day: requiredString(day.day, `weeklyPlan[${dayIndex}].day`),
            focus: requiredString(day.focus, `weeklyPlan[${dayIndex}].focus`),
            exercises: day.exercises.map((exercise, exerciseIndex) => ({
              name: requiredString(exercise.name, `weeklyPlan[${dayIndex}].exercises[${exerciseIndex}].name`),
              sets: requiredString(exercise.sets, `weeklyPlan[${dayIndex}].exercises[${exerciseIndex}].sets`),
              reps: requiredString(exercise.reps, `weeklyPlan[${dayIndex}].exercises[${exerciseIndex}].reps`),
              durationMinutes: optionalString(
                exercise.durationMinutes,
                `weeklyPlan[${dayIndex}].exercises[${exerciseIndex}].durationMinutes`
              ),
              notes: optionalString(exercise.notes, `weeklyPlan[${dayIndex}].exercises[${exerciseIndex}].notes`),
            })),
          }
        }),
        safetyNotes: parsed.safetyNotes,
        progressionNotes: requiredString(parsed.progressionNotes, 'progressionNotes'),
      }

      return plan
    } catch (error) {
      console.error('Response validation error:', error)
      throw new Error(`Invalid AI response format: ${error instanceof Error ? error.message : error}`)
    }
  }
}
