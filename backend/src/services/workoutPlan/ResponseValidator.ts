import { WorkoutPlan } from '../../types'

export class ResponseValidator {
  static validate(response: string): WorkoutPlan {
    try {
      console.error('ResponseValidator input length:', response.length)
      console.error('ResponseValidator input preview:', response.slice(0, 100))
      console.error('ResponseValidator input end preview:', response.slice(-100))

      const parsed = JSON.parse(response) as WorkoutPlan

      if (!parsed.summary || !parsed.weeklyPlan || !parsed.safetyNotes || !parsed.progressionNotes) {
        throw new Error('Missing required fields')
      }
      if (!Array.isArray(parsed.weeklyPlan)) throw new Error('weeklyPlan must be an array')

      parsed.weeklyPlan.forEach(day => {
        if (!day.day || !day.focus || !Array.isArray(day.exercises)) throw new Error('Invalid day structure')
        day.exercises.forEach(exercise => {
          if (!exercise.name || !exercise.sets || !exercise.reps) throw new Error('Invalid exercise structure')
        })
      })

      return parsed
    } catch (error) {
      console.error('Response validation error:', error)
      throw new Error('Invalid AI response format')
    }
  }
}
