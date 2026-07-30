import path from 'path'
import {
  readProfiles, validateGeneratedPlan, validateProfiles,
} from '../src/aiPlanEvaluation/common'

const root = path.resolve(__dirname, '../..')

describe('AI plan evaluation preparation', () => {
  it('contains exactly 30 valid distinct profiles', () => {
    const profiles = readProfiles(root)
    expect(validateProfiles(profiles)).toEqual([])
  })

  it('validates a structurally correct generated plan', () => {
    const validation = validateGeneratedPlan({
      summary: 'Plan',
      weeklyPlan: [{
        day: 'Day 1',
        focus: 'Full body',
        exercises: [{ name: 'Squat', sets: '3', reps: '10' }],
      }],
      safetyNotes: ['Use good form'],
      progressionNotes: 'Add load gradually',
    }, 1)
    expect(validation.schema_valid).toBe(true)
    expect(validation.days_correct).toBe(true)
  })

  it('reports missing exercise fields and incorrect day counts', () => {
    const validation = validateGeneratedPlan({
      summary: 'Plan',
      weeklyPlan: [{ day: 'Day 1', focus: 'Full body', exercises: [{}] }],
      safetyNotes: [],
      progressionNotes: 'Progress',
    }, 3)
    expect(validation.schema_valid).toBe(false)
    expect(validation.days_correct).toBe(false)
    expect(validation.type_errors).toContain(
      'weeklyPlan[0].exercises[0].name must be a non-empty string'
    )
  })
})
