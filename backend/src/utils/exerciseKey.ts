const EXERCISE_ALIASES: Record<string, string> = {
  'back squat': 'squat',
  'barbell back squat': 'squat',
  'barbell bench press': 'bench_press',
  'barbell deadlift': 'deadlift',
  'barbell shoulder press': 'shoulder_press',
  'bench press': 'bench_press',
  'overhead press': 'shoulder_press',
  'pull up': 'pull_up',
  'pull ups': 'pull_up',
  'pullup': 'pull_up',
  'pullups': 'pull_up',
  'shoulder press': 'shoulder_press',
}

const normalizeName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export const toExerciseKey = (name: string): string => {
  const normalized = normalizeName(name)
  return EXERCISE_ALIASES[normalized] ?? normalized.replace(/\s+/g, '_')
}
