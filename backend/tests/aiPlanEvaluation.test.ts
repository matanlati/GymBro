import path from 'path'
import {
  computeEquipmentAdherence, loadExerciseCatalog, readProfiles, validateGeneratedPlan,
  validateProfiles,
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

describe('equipment adherence metric', () => {
  const planWith = (names: string[]) => ({
    summary: 's',
    weeklyPlan: [{ day: 'Day 1', focus: 'Full body', exercises: names.map(name => ({ name, sets: '3', reps: '10' })) }],
    safetyNotes: ['n'],
    progressionNotes: 'p',
  })

  it('loads the vendored catalog', () => {
    const catalog = loadExerciseCatalog(root)
    expect(catalog.size).toBeGreaterThan(800)
    expect(catalog.get('barbell deadlift')).toBe('barbell')
  })

  it('scores a fully adherent dumbbell plan as 1', () => {
    const result = computeEquipmentAdherence(
      planWith(['Pushups', 'One-Arm Dumbbell Row']), ['Dumbbells'], root
    )
    expect(result.rate).toBe(1)
    expect(result.violations).toEqual([])
  })

  it('flags a barbell lift prescribed to a dumbbell-only user', () => {
    const result = computeEquipmentAdherence(
      planWith(['Pushups', 'Barbell Deadlift']), ['Dumbbells'], root
    )
    expect(result.resolved).toBe(2)
    expect(result.adherent).toBe(1)
    expect(result.rate).toBe(0.5)
    expect(result.violations[0]).toMatch(/Barbell Deadlift/)
  })

  it('ignores exercises that do not resolve to the catalog', () => {
    const result = computeEquipmentAdherence(
      planWith(['Pushups', 'Made Up Movement 9000']), ['Dumbbells'], root
    )
    expect(result.total).toBe(2)
    expect(result.resolved).toBe(1)
    expect(result.rate).toBe(1)
  })

  it('returns a null rate when nothing resolves', () => {
    const result = computeEquipmentAdherence(planWith(['Nonsense Lift']), ['Gym'], root)
    expect(result.rate).toBeNull()
  })

  it('accepts a barbell lift for a gym user', () => {
    const result = computeEquipmentAdherence(planWith(['Barbell Deadlift']), ['Gym', 'Barbell'], root)
    expect(result.rate).toBe(1)
  })

  it('handles a malformed plan without throwing', () => {
    expect(computeEquipmentAdherence(null, ['Gym'], root).total).toBe(0)
    expect(computeEquipmentAdherence({ weeklyPlan: 'nope' }, ['Gym'], root).total).toBe(0)
  })
})

describe('catalog resolution rate', () => {
  const planWith = (names: string[]) => ({
    summary: 's',
    weeklyPlan: [{ day: 'Day 1', focus: 'F', exercises: names.map(name => ({ name, sets: '3', reps: '10' })) }],
    safetyNotes: ['n'],
    progressionNotes: 'p',
  })

  it('is 1 when every prescribed exercise is a real catalog entry', () => {
    const result = computeEquipmentAdherence(planWith(['Pushups', 'Barbell Deadlift']), ['Gym'], root)
    expect(result.resolution_rate).toBe(1)
  })

  it('drops when the model invents exercise names', () => {
    const result = computeEquipmentAdherence(
      planWith(['Pushups', 'Ultra Mega Blaster', 'Imaginary Lift']), ['Gym'], root
    )
    expect(result.resolution_rate).toBeCloseTo(1 / 3, 5)
  })

  it('is 0 when nothing resolves', () => {
    expect(computeEquipmentAdherence(planWith(['Nope']), ['Gym'], root).resolution_rate).toBe(0)
  })

  it('is null for an empty plan', () => {
    expect(computeEquipmentAdherence(planWith([]), ['Gym'], root).resolution_rate).toBeNull()
  })
})
