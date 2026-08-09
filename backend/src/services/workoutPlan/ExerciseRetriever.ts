import { QuestionnaireData } from '../../types'
import EmbeddingService from './EmbeddingService'
import VectorStore, { ScoredDoc, SearchFilter } from './VectorStore'
import {
  Contraindication,
  isContraindicated,
  matchContraindications,
} from './contraindications'

/**
 * Maps the questionnaire's equipment vocabulary (aiPlanEvaluation/common.ts EQUIPMENT)
 * onto the free-exercise-db `equipment` values.
 */
const EQUIPMENT_MAP: Record<string, string[]> = {
  gym: [
    'barbell', 'dumbbell', 'cable', 'machine', 'body only', 'bands', 'kettlebells',
    'e-z curl bar', 'exercise ball', 'medicine ball', 'foam roll', 'other', 'none',
  ],
  home: ['body only', 'bands', 'dumbbell', 'exercise ball', 'foam roll', 'medicine ball', 'none'],
  dumbbells: ['dumbbell', 'body only', 'none'],
  machines: ['machine', 'cable', 'body only', 'none'],
  bodyweight: ['body only', 'none'],
  barbell: ['barbell', 'e-z curl bar', 'body only', 'none'],
  kettlebells: ['kettlebells', 'body only', 'none'],
}

/** A user of level X may be given exercises up to and including level X. */
const LEVEL_MAP: Record<string, string[]> = {
  beginner: ['beginner'],
  intermediate: ['beginner', 'intermediate'],
  advanced: ['beginner', 'intermediate', 'expert'],
  expert: ['beginner', 'intermediate', 'expert'],
}

/**
 * Muscle-group targets per goal. Retrieval runs one vector query per target so
 * the shortlist covers the whole body rather than whatever one blended query
 * happens to rank highest.
 */
const GOAL_TARGETS: Record<string, { label: string; muscles: string[] }[]> = {
  muscle_gain: [
    { label: 'chest and pushing strength', muscles: ['chest', 'triceps'] },
    { label: 'back and pulling strength', muscles: ['lats', 'middle back', 'biceps'] },
    { label: 'leg strength and lower body power', muscles: ['quadriceps', 'hamstrings', 'glutes'] },
    { label: 'shoulder development', muscles: ['shoulders', 'traps'] },
    { label: 'core strength and trunk stability', muscles: ['abdominals', 'lower back'] },
  ],
  strength: [
    { label: 'heavy compound pressing strength', muscles: ['chest', 'triceps', 'shoulders'] },
    { label: 'heavy pulling and back strength', muscles: ['lats', 'middle back', 'biceps'] },
    { label: 'lower body compound strength', muscles: ['quadriceps', 'hamstrings', 'glutes'] },
    { label: 'core bracing and stability', muscles: ['abdominals', 'lower back'] },
  ],
  weight_loss: [
    { label: 'full body conditioning and fat loss circuit', muscles: ['quadriceps', 'glutes', 'hamstrings'] },
    { label: 'upper body pushing endurance', muscles: ['chest', 'shoulders', 'triceps'] },
    { label: 'upper body pulling endurance', muscles: ['lats', 'middle back', 'biceps'] },
    { label: 'core and midsection work', muscles: ['abdominals'] },
    { label: 'calves and lower leg conditioning', muscles: ['calves'] },
  ],
  endurance: [
    { label: 'cardiovascular endurance work', muscles: ['quadriceps', 'hamstrings', 'calves', 'glutes'] },
    { label: 'upper body muscular endurance', muscles: ['chest', 'shoulders', 'lats', 'middle back'] },
    { label: 'core endurance and stability', muscles: ['abdominals', 'lower back'] },
  ],
  general_fitness: [
    { label: 'full body functional strength', muscles: ['quadriceps', 'glutes', 'hamstrings'] },
    { label: 'upper body pushing', muscles: ['chest', 'shoulders', 'triceps'] },
    { label: 'upper body pulling', muscles: ['lats', 'middle back', 'biceps'] },
    { label: 'core stability', muscles: ['abdominals', 'lower back'] },
  ],
}

const DEFAULT_TARGETS = GOAL_TARGETS.general_fitness
const KNOWLEDGE_K = 4
const MIN_PER_TARGET = 4
const MAX_PER_TARGET = 10

/**
 * The shortlist must comfortably exceed what the plan will consume
 * (trainingDays x exercises-per-day), or the model runs out of candidates and
 * either repeats itself or invents exercises.
 */
function perTargetK(trainingDays: string | number | undefined, targetCount: number): number {
  const days = Number(trainingDays)
  if (!Number.isFinite(days) || days <= 0) return MIN_PER_TARGET
  // ~7 slots per day, doubled as headroom so the model can choose rather than take.
  const needed = Math.ceil((days * 7 * 2) / Math.max(targetCount, 1))
  return Math.min(MAX_PER_TARGET, Math.max(MIN_PER_TARGET, needed))
}

export interface RetrievalResult {
  exercises: ScoredDoc[]
  knowledge: ScoredDoc[]
  advisories: string[]
  conditions: Contraindication[]
  /** Set when retrieval degraded (embedding endpoint down, empty catalog, ...). */
  degradedReason?: string
}

export const EMPTY_RESULT: RetrievalResult = {
  exercises: [],
  knowledge: [],
  advisories: [],
  conditions: [],
}

class ExerciseRetriever {
  /**
   * Translates the free-text equipment field into dataset equipment values.
   *
   * Tokens are unioned, but "bodyweight" is treated as a floor rather than a
   * grant: selecting "Home, Bodyweight" must not hand the user dumbbells just
   * because "home" implies a broader kit. Any explicit gear token overrides it.
   */
  resolveEquipment(equipmentAvailable?: string): Set<string> | undefined {
    const raw = (equipmentAvailable || '').toLowerCase()
    if (!raw.trim()) return undefined

    const tokens = Object.keys(EQUIPMENT_MAP).filter(token => raw.includes(token))
    if (!tokens.length) return undefined

    // Gear the user named explicitly. "gym" and "home" are venues, not gear.
    const explicitGear = tokens.filter(
      token => token !== 'bodyweight' && token !== 'home' && token !== 'gym'
    )
    const hasVenue = tokens.includes('gym')

    // Bodyweight-only (no gym, no named gear) stays strictly bodyweight.
    if (tokens.includes('bodyweight') && !explicitGear.length && !hasVenue) {
      return new Set(EQUIPMENT_MAP.bodyweight)
    }

    const allowed = new Set<string>()
    for (const token of tokens) {
      EQUIPMENT_MAP[token].forEach(value => allowed.add(value))
    }
    return allowed.size ? allowed : undefined
  }

  resolveLevels(trainingLevel?: string): Set<string> | undefined {
    const level = (trainingLevel || '').toLowerCase().trim()
    const levels = LEVEL_MAP[level]
    return levels ? new Set(levels) : undefined
  }

  resolveTargets(fitnessGoal?: string): { label: string; muscles: string[] }[] {
    const goal = (fitnessGoal || '').toLowerCase().trim()
    return GOAL_TARGETS[goal] || DEFAULT_TARGETS
  }

  async retrieve(questionnaireData: QuestionnaireData): Promise<RetrievalResult> {
    const conditions = matchContraindications(questionnaireData.injuries)
    const advisories = conditions.map(condition => condition.advice)

    try {
      await VectorStore.load()
      if (!VectorStore.size()) {
        return {
          ...EMPTY_RESULT,
          advisories,
          conditions,
          degradedReason: 'exercise catalog is empty — run npm run rag:ingest',
        }
      }

      const equipment = this.resolveEquipment(questionnaireData.equipmentAvailable)
      const levels = this.resolveLevels(questionnaireData.trainingLevel)
      const targets = this.resolveTargets(questionnaireData.fitnessGoal)

      const goal = questionnaireData.fitnessGoal || 'general fitness'
      const level = questionnaireData.trainingLevel || 'beginner'

      // One query per muscle-group target, plus one advisory-knowledge query.
      const exerciseQueries = targets.map(
        target => `${target.label} for a ${level} focused on ${goal}`
      )
      const knowledgeQuery =
        `${level} ${goal} training principles, safety and programming` +
        `${questionnaireData.injuries ? ` with ${questionnaireData.injuries}` : ''}`

      const vectors = await EmbeddingService.embed([...exerciseQueries, knowledgeQuery])
      const knowledgeVector = vectors[vectors.length - 1]

      const seen = new Set<string>()
      const exercises: ScoredDoc[] = []
      const perTarget = perTargetK(questionnaireData.trainingDays, targets.length)

      targets.forEach((target, index) => {
        const filter: SearchFilter = {
          docType: 'exercise',
          equipment,
          levels,
          primaryMuscles: new Set(target.muscles),
        }
        // Over-fetch, then drop contraindicated hits and de-duplicate.
        const hits = VectorStore.search(vectors[index], filter, perTarget * 4)
        let kept = 0
        for (const hit of hits) {
          if (kept >= perTarget) break
          if (seen.has(hit.sourceId)) continue
          if (isContraindicated(hit, conditions)) continue
          seen.add(hit.sourceId)
          exercises.push(hit)
          kept += 1
        }
      })

      const knowledge = VectorStore.search(knowledgeVector, { docType: 'knowledge' }, KNOWLEDGE_K)

      return { exercises, knowledge, advisories, conditions }
    } catch (error) {
      // RAG must degrade to the previous behavior, never break plan generation.
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[ExerciseRetriever] retrieval unavailable, continuing without RAG: ${message}`)
      return { ...EMPTY_RESULT, advisories, conditions, degradedReason: message }
    }
  }
}

export default new ExerciseRetriever()
