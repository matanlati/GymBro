import { toExerciseKey } from '../src/utils/exerciseKey'

describe('toExerciseKey', () => {
  it('maps known exercise aliases to the same key', () => {
    expect(toExerciseKey('Bench Press')).toBe('bench_press')
    expect(toExerciseKey('Barbell Bench Press')).toBe('bench_press')
    expect(toExerciseKey('Pull-ups')).toBe('pull_up')
  })

  it('creates a stable key for an unknown exercise name', () => {
    expect(toExerciseKey('Incline Dumbbell Press')).toBe('incline_dumbbell_press')
  })
})
