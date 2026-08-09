import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export const PROFILE_IDS = Array.from(
  { length: 30 },
  (_, index) => `PLAN-PROFILE-${String(index + 1).padStart(3, '0')}`
)
export const QUESTIONNAIRE_FIELDS = [
  'age', 'gender', 'height', 'weight', 'fitnessGoal', 'trainingLevel',
  'trainingDays', 'injuries', 'preferredWorkoutType', 'equipmentAvailable',
] as const
export const GOALS = ['weight_loss', 'muscle_gain', 'strength', 'endurance', 'general_fitness']
export const LEVELS = ['beginner', 'intermediate', 'advanced']
export const GENDERS = ['male', 'female', 'other']
export const WORKOUT_TYPES = ['strength', 'cardio', 'mixed']
export const TRAINING_DAYS = ['2', '3', '4', '5', '6']
export const EQUIPMENT = ['Gym', 'Home', 'Dumbbells', 'Machines', 'Bodyweight', 'Barbell', 'Kettlebells']
export const CSV_COLUMNS = [
  'run_id', 'test_id', 'profile_id', 'repetition', 'provider', 'model',
  'prompt_version', 'knowledge_base_version', 'generation_time_ms',
  'generation_status', 'schema_valid', 'expected_days', 'generated_days',
  'days_correct', 'equipment_adherent', 'catalog_resolution_rate', 'constraint_adherent',
  'goal_relevance_rating', 'personalization_rating', 'constraint_rating',
  'weekly_structure_rating', 'completeness_rating', 'clarity_rating',
  'safety_rating', 'overall_rating', 'unavailable_equipment_defect',
  'ignored_constraint_defect', 'missing_field_defect',
  'duplicate_or_contradictory_exercise', 'implausible_volume_defect',
  'critical_safety_defect', 'reviewer_id', 'review_notes', 'evidence_path',
]

export type Questionnaire = Record<(typeof QUESTIONNAIRE_FIELDS)[number], string>
export interface AiPlanProfile {
  profile_id: string
  name: string
  purpose: string
  questionnaire: Questionnaire
  expected: { training_days: number; equipment: string[]; constraints: string[] }
}
export interface ValidationResult {
  schema_valid: boolean
  expected_days: number
  generated_days: number | null
  days_correct: boolean
  missing_fields: string[]
  type_errors: string[]
  warnings: string[]
}

export interface EquipmentAdherence {
  /** Prescribed exercises whose name resolves to a catalog entry. */
  resolved: number
  total: number
  /** Resolved exercises the user actually has equipment for. */
  adherent: number
  /** adherent / resolved, or null when nothing resolved. */
  rate: number | null
  /**
   * resolved / total — the share of prescribed exercises that are real catalog
   * entries at all. A grounded plan scores near 1; an ungrounded model that
   * invents names scores near 0, which is what `rate` alone cannot show.
   */
  resolution_rate: number | null
  violations: string[]
}

/**
 * Maps the questionnaire equipment vocabulary onto free-exercise-db values.
 * Mirrors ExerciseRetriever's EQUIPMENT_MAP — kept local so the evaluation
 * harness stays runnable without a database connection.
 */
const EVAL_EQUIPMENT_MAP: Record<string, string[]> = {
  gym: ['barbell', 'dumbbell', 'cable', 'machine', 'body only', 'bands', 'kettlebells',
    'e-z curl bar', 'exercise ball', 'medicine ball', 'foam roll', 'other', 'none'],
  home: ['body only', 'bands', 'dumbbell', 'exercise ball', 'foam roll', 'medicine ball', 'none'],
  dumbbells: ['dumbbell', 'body only', 'none'],
  machines: ['machine', 'cable', 'body only', 'none'],
  bodyweight: ['body only', 'none'],
  barbell: ['barbell', 'e-z curl bar', 'body only', 'none'],
  kettlebells: ['kettlebells', 'body only', 'none'],
}

let catalogCache: Map<string, string> | null = null

/** name (lowercased) -> equipment, from the vendored exercise catalog. */
export function loadExerciseCatalog(root = findProjectRoot()): Map<string, string> {
  if (catalogCache) return catalogCache
  const file = path.join(root, 'knowledge-base', 'exercises.json')
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    name: string
    equipment?: string | null
  }[]
  catalogCache = new Map(raw.map(item => [item.name.toLowerCase(), (item.equipment || 'none').toLowerCase()]))
  return catalogCache
}

/**
 * Percentage of prescribed exercises that resolve to catalog entries the user
 * actually has equipment for. Only computable now that a controlled
 * exercise-equipment catalog exists.
 */
export function computeEquipmentAdherence(
  plan: unknown,
  equipmentAvailable: string[],
  root = findProjectRoot()
): EquipmentAdherence {
  const catalog = loadExerciseCatalog(root)
  const allowed = new Set<string>()
  for (const item of equipmentAvailable) {
    const values = EVAL_EQUIPMENT_MAP[item.toLowerCase()]
    if (values) values.forEach(value => allowed.add(value))
  }

  const weeklyPlan = (plan as { weeklyPlan?: unknown })?.weeklyPlan
  const names: string[] = []
  if (Array.isArray(weeklyPlan)) {
    for (const day of weeklyPlan) {
      const exercises = (day as { exercises?: unknown })?.exercises
      if (!Array.isArray(exercises)) continue
      for (const exercise of exercises) {
        const name = (exercise as { name?: unknown })?.name
        if (typeof name === 'string' && name.trim()) names.push(name.trim())
      }
    }
  }

  const violations: string[] = []
  let resolved = 0
  let adherent = 0

  for (const name of names) {
    const equipment = catalog.get(name.toLowerCase())
    if (equipment === undefined) continue
    resolved += 1
    if (!allowed.size || allowed.has(equipment)) adherent += 1
    else violations.push(`${name} (requires ${equipment})`)
  }

  return {
    resolved,
    total: names.length,
    adherent,
    rate: resolved ? adherent / resolved : null,
    resolution_rate: names.length ? resolved / names.length : null,
    violations,
  }
}

export function findProjectRoot(): string {
  const configured = process.env.AI_PLAN_PROJECT_ROOT
  const candidates = configured
    ? [path.resolve(configured)]
    : [process.cwd(), path.resolve(process.cwd(), '..'), path.resolve(__dirname, '../../..')]
  const root = candidates.find(candidate =>
    fs.existsSync(path.join(candidate, 'test-data', 'ai-plan-profiles.json'))
  )
  if (!root) throw new Error('Cannot find project root containing test-data/ai-plan-profiles.json')
  return root
}

export function readProfiles(root = findProjectRoot()): AiPlanProfile[] {
  return JSON.parse(
    fs.readFileSync(path.join(root, 'test-data', 'ai-plan-profiles.json'), 'utf8')
  ) as AiPlanProfile[]
}

export function validateProfiles(profiles: AiPlanProfile[]): string[] {
  const errors: string[] = []
  if (profiles.length !== 30) errors.push(`Expected 30 profiles, found ${profiles.length}`)
  const ids = profiles.map(profile => profile.profile_id)
  if (new Set(ids).size !== ids.length) errors.push('Profile IDs are not unique')
  if (JSON.stringify([...ids].sort()) !== JSON.stringify([...PROFILE_IDS].sort())) {
    errors.push('Profile IDs must be exactly PLAN-PROFILE-001 through PLAN-PROFILE-030')
  }
  const payloads = new Set<string>()
  for (const profile of profiles) {
    if (!profile.name?.trim() || !profile.purpose?.trim()) {
      errors.push(`${profile.profile_id}: name and purpose are required`)
    }
    for (const field of QUESTIONNAIRE_FIELDS) {
      if (!(field in (profile.questionnaire || {}))) errors.push(`${profile.profile_id}: missing ${field}`)
    }
    const q = profile.questionnaire
    if (!GENDERS.includes(q.gender)) errors.push(`${profile.profile_id}: unsupported gender`)
    if (!GOALS.includes(q.fitnessGoal)) errors.push(`${profile.profile_id}: unsupported fitnessGoal`)
    if (!LEVELS.includes(q.trainingLevel)) errors.push(`${profile.profile_id}: unsupported trainingLevel`)
    if (!TRAINING_DAYS.includes(String(q.trainingDays))) errors.push(`${profile.profile_id}: unsupported trainingDays`)
    if (!WORKOUT_TYPES.includes(q.preferredWorkoutType)) errors.push(`${profile.profile_id}: unsupported preferredWorkoutType`)
    for (const field of ['age', 'height', 'weight'] as const) {
      const value = Number(q[field])
      if (!Number.isFinite(value) || value <= 0) errors.push(`${profile.profile_id}: ${field} must be a positive number`)
    }
    const equipment = q.equipmentAvailable.split(',').map(value => value.trim()).filter(Boolean)
    if (!equipment.length || equipment.some(value => !EQUIPMENT.includes(value))) {
      errors.push(`${profile.profile_id}: unsupported or empty equipmentAvailable`)
    }
    if (profile.expected?.training_days !== Number(q.trainingDays)) {
      errors.push(`${profile.profile_id}: expected.training_days does not match questionnaire`)
    }
    const canonical = JSON.stringify(q)
    if (payloads.has(canonical)) errors.push(`${profile.profile_id}: duplicate questionnaire payload`)
    payloads.add(canonical)
  }
  return errors
}

export function validateGeneratedPlan(response: unknown, expectedDays: number): ValidationResult {
  const missing: string[] = []
  const types: string[] = []
  const warnings = [
    'Equipment adherence is computed automatically for exercises that resolve to the '
      + 'vendored catalog (knowledge-base/exercises.json); unresolved names still need review.',
    'Constraint adherence requires human review; constraints are handled as natural language.',
    'Internal LLM retry and correction counts are not exposed by the production API.',
  ]
  const plan = response as Record<string, unknown> | null
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return { schema_valid: false, expected_days: expectedDays, generated_days: null, days_correct: false, missing_fields: ['response'], type_errors: ['response must be an object'], warnings }
  }
  for (const field of ['summary', 'weeklyPlan', 'safetyNotes', 'progressionNotes']) {
    if (!(field in plan) || plan[field] === null) missing.push(field)
  }
  if (typeof plan.summary !== 'string') types.push('summary must be a string')
  if (!Array.isArray(plan.weeklyPlan)) types.push('weeklyPlan must be an array')
  if (!Array.isArray(plan.safetyNotes) || plan.safetyNotes.some(item => typeof item !== 'string')) {
    types.push('safetyNotes must be an array of strings')
  }
  if (typeof plan.progressionNotes !== 'string') types.push('progressionNotes must be a string')
  if (Array.isArray(plan.weeklyPlan)) {
    plan.weeklyPlan.forEach((day, dayIndex) => {
      const item = day as Record<string, unknown>
      for (const field of ['day', 'focus', 'exercises']) {
        if (!item || item[field] === undefined || item[field] === null) missing.push(`weeklyPlan[${dayIndex}].${field}`)
      }
      if (typeof item?.day !== 'string') types.push(`weeklyPlan[${dayIndex}].day must be a string`)
      if (typeof item?.focus !== 'string') types.push(`weeklyPlan[${dayIndex}].focus must be a string`)
      if (!Array.isArray(item?.exercises) || item.exercises.length === 0) {
        types.push(`weeklyPlan[${dayIndex}].exercises must be a non-empty array`)
      } else {
        item.exercises.forEach((exercise, exerciseIndex) => {
          const value = exercise as Record<string, unknown>
          for (const field of ['name', 'sets', 'reps']) {
            if (typeof value?.[field] !== 'string' || !(value[field] as string).trim()) {
              types.push(`weeklyPlan[${dayIndex}].exercises[${exerciseIndex}].${field} must be a non-empty string`)
            }
          }
          if (value?.durationMinutes !== undefined && (
            typeof value.durationMinutes !== 'string' || !value.durationMinutes.trim()
          )) types.push(`weeklyPlan[${dayIndex}].exercises[${exerciseIndex}].durationMinutes must be a non-empty string`)
        })
      }
    })
  }
  const generatedDays = Array.isArray(plan.weeklyPlan) ? plan.weeklyPlan.length : null
  return {
    schema_valid: missing.length === 0 && types.length === 0,
    expected_days: expectedDays,
    generated_days: generatedDays,
    days_correct: generatedDays === expectedDays,
    missing_fields: missing,
    type_errors: types,
    warnings,
  }
}

export function sha256File(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

export function atomicWrite(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`
  const descriptor = fs.openSync(temporary, 'wx')
  try {
    fs.writeFileSync(descriptor, content, 'utf8')
    fs.fsyncSync(descriptor)
  } finally {
    fs.closeSync(descriptor)
  }
  fs.renameSync(temporary, file)
}

export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
