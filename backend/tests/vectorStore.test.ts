import VectorStore, { cosine, StoredDoc } from '../src/services/workoutPlan/VectorStore'

const makeDoc = (overrides: Partial<StoredDoc> & { sourceId: string; name: string }): StoredDoc => ({
  docType: 'exercise',
  text: overrides.name,
  equipment: '',
  level: 'beginner',
  primaryMuscles: [],
  secondaryMuscles: [],
  category: 'strength',
  mechanic: 'compound',
  instructions: [],
  ...overrides,
})

describe('cosine', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosine([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 10)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 10)
  })

  it('returns -1 for opposite vectors', () => {
    expect(cosine([1, 1], [-1, -1])).toBeCloseTo(-1, 10)
  })

  it('is scale invariant', () => {
    expect(cosine([1, 2, 3], [10, 20, 30])).toBeCloseTo(1, 10)
  })

  it('matches a hand-computed value', () => {
    // dot = 11; |a| = 5; |b| = sqrt(5) -> 11 / (5 * 2.2360679...) = 0.98386991
    expect(cosine([3, 4], [1, 2])).toBeCloseTo(0.98386991, 6)
  })

  it('returns 0 when either vector is all zeros', () => {
    expect(cosine([0, 0], [1, 1])).toBe(0)
  })
})

describe('VectorStore.search', () => {
  beforeEach(() => {
    VectorStore.reset()
    VectorStore.setDocs(
      [
        makeDoc({ sourceId: 'a', name: 'Barbell Squat', equipment: 'barbell', primaryMuscles: ['quadriceps'], level: 'intermediate' }),
        makeDoc({ sourceId: 'b', name: 'Dumbbell Curl', equipment: 'dumbbell', primaryMuscles: ['biceps'] }),
        makeDoc({ sourceId: 'c', name: 'Push-Up', equipment: 'body only', primaryMuscles: ['chest'] }),
        makeDoc({ sourceId: 'd', name: 'Principle', docType: 'knowledge', equipment: '' }),
      ],
      [
        [1, 0, 0],
        [0, 1, 0],
        [0.9, 0.1, 0],
        [0, 0, 1],
      ]
    )
  })

  afterAll(() => VectorStore.reset())

  it('ranks by cosine similarity, closest first', () => {
    const results = VectorStore.search([1, 0, 0], {}, 3)
    expect(results.map(r => r.sourceId)).toEqual(['a', 'c', 'b'])
    expect(results[0].score).toBeCloseTo(1, 6)
  })

  it('respects k', () => {
    expect(VectorStore.search([1, 0, 0], {}, 2)).toHaveLength(2)
  })

  it('never returns a barbell lift to a dumbbell-only user', () => {
    const results = VectorStore.search([1, 0, 0], { equipment: new Set(['dumbbell', 'body only']) }, 10)
    expect(results.map(r => r.sourceId)).not.toContain('a')
    expect(results.every(r => r.equipment !== 'barbell')).toBe(true)
  })

  it('filters by docType', () => {
    const results = VectorStore.search([0, 0, 1], { docType: 'knowledge' }, 10)
    expect(results).toHaveLength(1)
    expect(results[0].sourceId).toBe('d')
  })

  it('filters by level', () => {
    const results = VectorStore.search([1, 0, 0], { levels: new Set(['beginner']) }, 10)
    expect(results.map(r => r.sourceId)).not.toContain('a')
  })

  it('filters by primary muscle', () => {
    const results = VectorStore.search([1, 0, 0], { primaryMuscles: new Set(['chest']) }, 10)
    expect(results.map(r => r.sourceId)).toEqual(['c'])
  })

  it('excludes explicit sourceIds', () => {
    const results = VectorStore.search([1, 0, 0], { excludeSourceIds: new Set(['a']) }, 10)
    expect(results.map(r => r.sourceId)).not.toContain('a')
  })

  it('returns an empty array when every candidate is filtered out', () => {
    expect(VectorStore.search([1, 0, 0], { equipment: new Set(['kettlebells']) }, 5)).toEqual([])
  })

  it('returns an empty array when the store is empty', () => {
    VectorStore.reset()
    expect(VectorStore.search([1, 0, 0], {}, 5)).toEqual([])
  })
})
