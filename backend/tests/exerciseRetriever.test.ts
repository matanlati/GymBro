jest.mock('../src/services/workoutPlan/EmbeddingService', () => ({
  __esModule: true,
  default: { embed: jest.fn(), embedOne: jest.fn(), getConfig: jest.fn() },
}))

import ExerciseRetriever from '../src/services/workoutPlan/ExerciseRetriever'
import RagRetrieverService from '../src/services/workoutPlan/RagRetrieverService'
import EmbeddingService from '../src/services/workoutPlan/EmbeddingService'
import VectorStore, { StoredDoc } from '../src/services/workoutPlan/VectorStore'
import {
  isContraindicated,
  matchContraindications,
} from '../src/services/workoutPlan/contraindications'

const MockEmbeddingService = EmbeddingService as jest.Mocked<typeof EmbeddingService>

const makeDoc = (
  sourceId: string,
  name: string,
  overrides: Partial<StoredDoc> = {}
): StoredDoc => ({
  sourceId,
  docType: 'exercise',
  name,
  text: name,
  equipment: 'body only',
  level: 'beginner',
  primaryMuscles: ['chest'],
  secondaryMuscles: [],
  category: 'strength',
  mechanic: 'compound',
  instructions: [],
  ...overrides,
})

const CATALOG: StoredDoc[] = [
  makeDoc('exercise:bench', 'Barbell Bench Press', { equipment: 'barbell', primaryMuscles: ['chest'] }),
  makeDoc('exercise:pushup', 'Push-Up', { equipment: 'body only', primaryMuscles: ['chest'] }),
  makeDoc('exercise:dbpress', 'Dumbbell Bench Press', { equipment: 'dumbbell', primaryMuscles: ['chest'] }),
  makeDoc('exercise:squat', 'Barbell Squat', { equipment: 'barbell', primaryMuscles: ['quadriceps'] }),
  makeDoc('exercise:legpress', 'Leg Press', { equipment: 'machine', primaryMuscles: ['quadriceps'] }),
  makeDoc('exercise:dbrow', 'Dumbbell Row', { equipment: 'dumbbell', primaryMuscles: ['lats'] }),
  makeDoc('exercise:latpull', 'Lat Pulldown', { equipment: 'cable', primaryMuscles: ['lats'] }),
  makeDoc('exercise:ohp', 'Overhead Press', { equipment: 'barbell', primaryMuscles: ['shoulders'] }),
  makeDoc('exercise:raise', 'Dumbbell Lateral Raise', { equipment: 'dumbbell', primaryMuscles: ['shoulders'] }),
  makeDoc('exercise:plank', 'Plank', { equipment: 'body only', primaryMuscles: ['abdominals'] }),
  makeDoc('exercise:deadlift', 'Barbell Deadlift', { equipment: 'barbell', primaryMuscles: ['hamstrings'] }),
  makeDoc('exercise:boxjump', 'Box Jump', { equipment: 'body only', primaryMuscles: ['quadriceps'], category: 'plyometrics' }),
  makeDoc('exercise:expert', 'Expert Snatch', { equipment: 'barbell', primaryMuscles: ['shoulders'], level: 'expert' }),
  makeDoc('knowledge:principle', 'trainingPrinciples/0', {
    docType: 'knowledge', equipment: '', level: '', primaryMuscles: [], category: '',
  }),
]

const seedStore = () => {
  // Every vector is identical, so ranking is neutral and the assertions below
  // isolate filtering behavior rather than embedding quality.
  VectorStore.setDocs(CATALOG, CATALOG.map(() => [1, 0, 0]))
}

beforeEach(() => {
  jest.clearAllMocks()
  seedStore()
  jest.spyOn(VectorStore, 'load').mockResolvedValue(undefined)
  MockEmbeddingService.embed.mockImplementation(async (texts: string[]) =>
    texts.map(() => [1, 0, 0])
  )
})

afterAll(() => {
  jest.restoreAllMocks()
  VectorStore.reset()
})

describe('ExerciseRetriever.resolveEquipment', () => {
  it('maps dumbbells to dumbbell and bodyweight only', () => {
    const allowed = ExerciseRetriever.resolveEquipment('Dumbbells')!
    expect(allowed.has('dumbbell')).toBe(true)
    expect(allowed.has('barbell')).toBe(false)
    expect(allowed.has('machine')).toBe(false)
  })

  it('keeps a bodyweight-only user strictly bodyweight', () => {
    const allowed = ExerciseRetriever.resolveEquipment('Home, Bodyweight')!
    expect(allowed.has('dumbbell')).toBe(false)
    expect(allowed.has('barbell')).toBe(false)
    expect(allowed.has('body only')).toBe(true)
  })

  it('still grants named gear alongside bodyweight', () => {
    const allowed = ExerciseRetriever.resolveEquipment('Home, Bodyweight, Dumbbells')!
    expect(allowed.has('dumbbell')).toBe(true)
    expect(allowed.has('barbell')).toBe(false)
  })

  it('grants the full catalog for a gym user', () => {
    const allowed = ExerciseRetriever.resolveEquipment('Gym, Barbell, Machines')!
    expect(allowed.has('barbell')).toBe(true)
    expect(allowed.has('machine')).toBe(true)
  })

  it('returns undefined for empty or unrecognized text so nothing is over-filtered', () => {
    expect(ExerciseRetriever.resolveEquipment('')).toBeUndefined()
    expect(ExerciseRetriever.resolveEquipment('  ')).toBeUndefined()
    expect(ExerciseRetriever.resolveEquipment('spaceship')).toBeUndefined()
  })
})

describe('ExerciseRetriever.resolveLevels', () => {
  it('limits a beginner to beginner content', () => {
    expect([...ExerciseRetriever.resolveLevels('beginner')!]).toEqual(['beginner'])
  })

  it('lets an advanced user reach expert content', () => {
    expect(ExerciseRetriever.resolveLevels('advanced')!.has('expert')).toBe(true)
  })

  it('returns undefined for an unknown level', () => {
    expect(ExerciseRetriever.resolveLevels('wizard')).toBeUndefined()
  })
})

describe('matchContraindications', () => {
  it('matches knee pain', () => {
    expect(matchContraindications('Chronic right knee pain').map(c => c.id)).toEqual(['kneePain'])
  })

  it('matches Hebrew knee text', () => {
    expect(matchContraindications('רגישות קלה בברך ימין').map(c => c.id)).toEqual(['kneePain'])
  })

  it('does not fire on a negated injury statement', () => {
    expect(matchContraindications('No diagnosed injury; balance is occasionally limited.')).toEqual([])
    expect(matchContraindications('No current injury; prioritize controlled tempo.')).toEqual([])
  })

  it('returns nothing for empty text', () => {
    expect(matchContraindications('')).toEqual([])
    expect(matchContraindications(undefined)).toEqual([])
  })

  it('can match several conditions at once', () => {
    const ids = matchContraindications('knee pain and shoulder impingement').map(c => c.id)
    expect(ids).toContain('kneePain')
    expect(ids).toContain('shoulderInjury')
  })
})

describe('isContraindicated', () => {
  const knee = matchContraindications('knee pain')

  it('excludes squats and jumps for knee pain', () => {
    expect(isContraindicated({ name: 'Barbell Squat', primaryMuscles: ['quadriceps'], category: 'strength' }, knee)).toBe(true)
    expect(isContraindicated({ name: 'Box Jump', primaryMuscles: ['quadriceps'], category: 'plyometrics' }, knee)).toBe(true)
  })

  it('allows unrelated upper-body work', () => {
    expect(isContraindicated({ name: 'Dumbbell Row', primaryMuscles: ['lats'], category: 'strength' }, knee)).toBe(false)
  })

  it('excludes deadlifts for back pain', () => {
    const back = matchContraindications('lower back pain')
    expect(isContraindicated({ name: 'Barbell Deadlift', primaryMuscles: ['hamstrings'], category: 'strength' }, back)).toBe(true)
  })

  it('excludes overhead pressing for a shoulder injury', () => {
    const shoulder = matchContraindications('shoulder impingement')
    expect(isContraindicated({ name: 'Overhead Press', primaryMuscles: ['shoulders'], category: 'strength' }, shoulder)).toBe(true)
  })

  it('excludes nothing when there are no conditions', () => {
    expect(isContraindicated({ name: 'Barbell Squat', primaryMuscles: ['quadriceps'], category: 'strength' }, [])).toBe(false)
  })
})

describe('ExerciseRetriever.retrieve', () => {
  it('returns a non-empty shortlist for a normal profile', async () => {
    const result = await ExerciseRetriever.retrieve({
      fitnessGoal: 'muscle_gain', trainingLevel: 'beginner', equipmentAvailable: 'Gym, Barbell',
    })
    expect(result.exercises.length).toBeGreaterThan(0)
    expect(result.degradedReason).toBeUndefined()
  })

  it('never returns a barbell lift to a dumbbell-only user', async () => {
    const result = await ExerciseRetriever.retrieve({
      fitnessGoal: 'muscle_gain', trainingLevel: 'beginner', equipmentAvailable: 'Dumbbells',
    })
    expect(result.exercises.length).toBeGreaterThan(0)
    expect(result.exercises.every(e => e.equipment !== 'barbell')).toBe(true)
  })

  it('never returns knee-contraindicated work to a user with knee pain', async () => {
    const result = await ExerciseRetriever.retrieve({
      fitnessGoal: 'muscle_gain',
      trainingLevel: 'beginner',
      equipmentAvailable: 'Gym, Barbell, Machines',
      injuries: 'Chronic right knee pain; avoid deep knee flexion and jumping.',
    })
    const names = result.exercises.map(e => e.name)
    expect(names).not.toContain('Barbell Squat')
    expect(names).not.toContain('Box Jump')
    expect(result.advisories.join(' ')).toMatch(/Knee/)
  })

  it('never returns expert content to a beginner', async () => {
    const result = await ExerciseRetriever.retrieve({
      fitnessGoal: 'strength', trainingLevel: 'beginner', equipmentAvailable: 'Gym, Barbell',
    })
    expect(result.exercises.every(e => e.level !== 'expert')).toBe(true)
  })

  it('de-duplicates exercises across muscle-group queries', async () => {
    const result = await ExerciseRetriever.retrieve({
      fitnessGoal: 'muscle_gain', trainingLevel: 'beginner', equipmentAvailable: 'Gym',
    })
    const ids = result.exercises.map(e => e.sourceId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('retrieves advisory knowledge chunks alongside exercises', async () => {
    const result = await ExerciseRetriever.retrieve({
      fitnessGoal: 'muscle_gain', trainingLevel: 'beginner', equipmentAvailable: 'Gym',
    })
    expect(result.knowledge.every(doc => doc.docType === 'knowledge')).toBe(true)
  })

  it('degrades to an empty result when the embedding endpoint is down', async () => {
    MockEmbeddingService.embed.mockRejectedValue(new Error('ECONNREFUSED'))
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await ExerciseRetriever.retrieve({
      fitnessGoal: 'muscle_gain', trainingLevel: 'beginner', equipmentAvailable: 'Gym',
    })

    expect(result.exercises).toEqual([])
    expect(result.knowledge).toEqual([])
    expect(result.degradedReason).toContain('ECONNREFUSED')
    warn.mockRestore()
  })

  it('degrades when the catalog has not been ingested', async () => {
    VectorStore.reset()
    const result = await ExerciseRetriever.retrieve({
      fitnessGoal: 'muscle_gain', trainingLevel: 'beginner', equipmentAvailable: 'Gym',
    })
    expect(result.exercises).toEqual([])
    expect(result.degradedReason).toMatch(/catalog is empty/)
  })

  it('still reports injury advisories when retrieval degrades', async () => {
    VectorStore.reset()
    const result = await ExerciseRetriever.retrieve({
      fitnessGoal: 'muscle_gain', trainingLevel: 'beginner', injuries: 'knee pain',
    })
    expect(result.advisories.length).toBeGreaterThan(0)
  })
})

describe('RagRetrieverService', () => {
  it('delegates to the retriever and returns a populated result', async () => {
    const result = await RagRetrieverService.retrieve({
      fitnessGoal: 'muscle_gain', trainingLevel: 'beginner', equipmentAvailable: 'Gym',
    })
    expect(result.exercises.length).toBeGreaterThan(0)
  })

  it('returns the empty result for a missing questionnaire', async () => {
    const result = await RagRetrieverService.retrieve(null as never)
    expect(result.exercises).toEqual([])
  })
})
