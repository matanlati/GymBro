import { WorkoutPlan } from '../../types'

const DURATION_REPS = 'N/A'
const DURATION_SETS = '1'

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

function requiredExerciseString(
  value: unknown,
  path: string,
  fallback: string | undefined
): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim()) return value
  if (fallback !== undefined && (value === undefined || value === null || value === '')) return fallback
  throw new Error(`${path} must be a non-empty string`)
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? value : undefined
  }
  throw new Error(`${path} must be a non-empty string when provided`)
}

function validateStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array of strings`)
  return value
    .filter(item => item !== undefined && item !== null && item !== '')
    .map((item, index) => requiredString(item, `${path}[${index}]`))
}

function parseExpectedDays(value: string | number | undefined): number | undefined {
  if (value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

export class ResponseValidator {
  static validate(response: string, expectedTrainingDays?: string | number): WorkoutPlan {
    try {
      console.error('ResponseValidator input length:', response.length)
      console.error('ResponseValidator input preview:', response.slice(0, 100))
      console.error('ResponseValidator input end preview:', response.slice(-100))

      const parsed = JSON.parse(response) as RawWorkoutPlan

      if (!parsed.summary || !parsed.weeklyPlan || !parsed.safetyNotes || !parsed.progressionNotes) {
        throw new Error('Missing required fields')
      }
      if (!Array.isArray(parsed.weeklyPlan)) throw new Error('weeklyPlan must be an array')
      if (!parsed.weeklyPlan.length) throw new Error('weeklyPlan must be a non-empty array')
      const expectedDays = parseExpectedDays(expectedTrainingDays)
      if (expectedDays !== undefined && parsed.weeklyPlan.length !== expectedDays) {
        throw new Error(`weeklyPlan must contain exactly ${expectedDays} workout days`)
      }

      const plan: WorkoutPlan = {
        summary: requiredString(parsed.summary, 'summary'),
        weeklyPlan: parsed.weeklyPlan.map((day, dayIndex) => {
          if (!Array.isArray(day.exercises)) {
            throw new Error(`weeklyPlan[${dayIndex}].exercises must be an array`)
          }
          if (!day.exercises.length) {
            throw new Error(`weeklyPlan[${dayIndex}].exercises must be a non-empty array`)
          }
          return {
            day: requiredString(day.day, `weeklyPlan[${dayIndex}].day`),
            focus: requiredString(day.focus, `weeklyPlan[${dayIndex}].focus`),
            exercises: day.exercises.map((exercise, exerciseIndex) => {
              const path = `weeklyPlan[${dayIndex}].exercises[${exerciseIndex}]`
              const durationMinutes = optionalString(exercise.durationMinutes, `${path}.durationMinutes`)
              return {
                name: requiredString(exercise.name, `${path}.name`),
                sets: requiredExerciseString(exercise.sets, `${path}.sets`, durationMinutes ? DURATION_SETS : undefined),
                reps: requiredExerciseString(exercise.reps, `${path}.reps`, durationMinutes ? DURATION_REPS : undefined),
                durationMinutes,
                notes: optionalString(exercise.notes, `${path}.notes`),
              }
            }),
          }
        }),
        safetyNotes: validateStringArray(parsed.safetyNotes, 'safetyNotes'),
        progressionNotes: requiredString(parsed.progressionNotes, 'progressionNotes'),
      }

      return plan
    } catch (error) {
      console.error('Response validation error:', error)
      throw new Error(`Invalid AI response format: ${error instanceof Error ? error.message : error}`)
    }
  }
}
