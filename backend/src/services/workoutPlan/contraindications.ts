/**
 * Injury contraindications, applied as a HARD exclusion in retrieval stage 1.
 * An injury filter must never be left to cosine similarity.
 *
 * Seeded from the three conditions in knowledge-base/training-knowledge.json
 * and extended to the common cases that appear in the evaluation profiles.
 */

export interface Contraindication {
  id: string
  /** Lowercased substrings that indicate the user has this condition. */
  triggers: string[]
  /** Exercise-name substrings to exclude (lowercased, matched on name). */
  excludeNamePatterns: string[]
  /** primaryMuscles values to exclude outright. */
  excludeMuscles?: string[]
  /** free-exercise-db categories to exclude. */
  excludeCategories?: string[]
  /** Advisory line handed to the LLM alongside the shortlist. */
  advice: string
}

export const CONTRAINDICATIONS: Contraindication[] = [
  {
    id: 'kneePain',
    // Includes the Hebrew "knee" (ברך) seen in the evaluation profiles.
    triggers: ['knee', 'ברך'],
    excludeNamePatterns: [
      'squat', 'lunge', 'jump', 'leap', 'hop', 'sprint', 'box jump',
      'burpee', 'pistol', 'sissy', 'step-up', 'step up', 'leg extension',
      'deep knee', 'plyo', 'bound', 'skater',
    ],
    excludeCategories: ['plyometrics'],
    advice:
      'Knee: avoid deep knee flexion, jumping and high-impact work. Prefer leg press, ' +
      'hip hinges, and lighter partial-range work.',
  },
  {
    id: 'backPain',
    triggers: ['back pain', 'lower-back', 'lower back', 'lumbar', 'herniat', 'sciatic', 'spine'],
    excludeNamePatterns: [
      'deadlift', 'good morning', 'back extension', 'hyperextension',
      'bent over', 'bent-over', 'clean', 'snatch', 'jerk', 'atlas stone',
      'superman', 'sit-up', 'situp', 'russian twist',
    ],
    excludeCategories: ['olympic weightlifting', 'strongman', 'powerlifting'],
    advice:
      'Lower back: skip conventional deadlifts and heavy axial loading. Emphasize braced ' +
      'core stability, supported/chest-supported variations, and neutral-spine positions.',
  },
  {
    id: 'shoulderInjury',
    triggers: ['shoulder', 'rotator cuff', 'impingement'],
    excludeNamePatterns: [
      'overhead', 'military press', 'shoulder press', 'behind the neck',
      'behind neck', 'upright row', 'snatch', 'jerk', 'push press',
      'dip', 'lateral raise', 'handstand', 'pullover',
    ],
    advice:
      'Shoulder: no overhead pressing and avoid painful ranges. Prefer neutral-grip and ' +
      'chest-press variations kept below shoulder height.',
  },
  {
    id: 'wristPain',
    triggers: ['wrist', 'carpal'],
    excludeNamePatterns: [
      'push-up', 'push up', 'pushup', 'plank', 'handstand', 'front rack',
      'wrist roller', 'clean', 'burpee', 'mountain climber',
    ],
    advice:
      'Wrist: avoid loaded wrist-extension positions such as floor push-ups and long planks. ' +
      'Prefer neutral-grip dumbbell work, machines, and handles.',
  },
  {
    id: 'ankleInjury',
    triggers: ['ankle', 'achilles', 'calf strain', 'plantar'],
    excludeNamePatterns: [
      'run', 'sprint', 'jump', 'leap', 'hop', 'skip', 'calf raise',
      'burpee', 'plyo', 'bound', 'skater', 'jog',
    ],
    excludeCategories: ['plyometrics'],
    advice:
      'Ankle: use low-impact conditioning (cycling, rowing, elliptical) and avoid running ' +
      'and jumping until cleared.',
  },
  {
    id: 'hipPain',
    triggers: ['hip', 'groin', 'piriformis'],
    excludeNamePatterns: [
      'deep squat', 'sumo', 'wide stance', 'adductor', 'side split',
      'jump', 'box jump', 'pistol',
    ],
    advice:
      'Hip: avoid end-range hip flexion/abduction and wide-stance loading. Keep ranges ' +
      'pain-free and progress gradually.',
  },
  {
    id: 'neckPain',
    triggers: ['neck', 'cervical', 'whiplash'],
    excludeNamePatterns: [
      'behind the neck', 'behind neck', 'neck', 'bridge', 'shrug',
      'sit-up', 'situp', 'crunch',
    ],
    excludeMuscles: ['neck'],
    advice:
      'Neck: avoid direct neck loading, behind-the-neck positions, and crunch-style flexion. ' +
      'Keep the head in a neutral position.',
  },
  {
    id: 'elbowPain',
    triggers: ['elbow', 'tennis elbow', 'golfer', 'tendonitis', 'tendinitis'],
    excludeNamePatterns: [
      'skull', 'french press', 'preacher', 'chin-up', 'chin up',
      'close-grip', 'close grip', 'kickback', 'reverse curl',
    ],
    advice:
      'Elbow: reduce direct arm-flexor/extensor loading and avoid deep elbow-flexion ' +
      'positions. Use neutral grips and moderate loads.',
  },
]

/** Phrases that mean "no injury" — prevents "no knee pain" matching kneePain. */
const NEGATIONS = [
  'no diagnosed injury',
  'no current injury',
  'no injuries',
  'no injury',
  'none',
  'n/a',
]

/**
 * Maps free-text questionnaire injury notes onto contraindication entries.
 * Unmatched text yields an empty list, so retrieval proceeds unfiltered.
 */
export function matchContraindications(injuries?: string): Contraindication[] {
  const text = (injuries || '').toLowerCase().trim()
  if (!text) return []

  // "No diagnosed injury; balance is occasionally limited." must not trigger anything
  // just because a body part happens to be named later in an unrelated clause.
  const isNegated = NEGATIONS.some(phrase => text.startsWith(phrase))
  if (isNegated) return []

  return CONTRAINDICATIONS.filter(entry =>
    entry.triggers.some(trigger => text.includes(trigger))
  )
}

/** True when an exercise is contraindicated for the given conditions. */
export function isContraindicated(
  exercise: { name: string; primaryMuscles: string[]; category: string },
  conditions: Contraindication[]
): boolean {
  const name = exercise.name.toLowerCase()
  return conditions.some(condition => {
    if (condition.excludeNamePatterns.some(pattern => name.includes(pattern))) return true
    if (condition.excludeCategories?.includes(exercise.category)) return true
    if (condition.excludeMuscles?.some(muscle => exercise.primaryMuscles.includes(muscle))) {
      return true
    }
    return false
  })
}
