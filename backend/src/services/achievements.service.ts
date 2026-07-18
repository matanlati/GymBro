import {
  AchievementCategory,
  AchievementUnlock,
  IAchievementUnlock,
} from '../models/AchievementUnlock.model'
import { WorkoutSession } from '../models/WorkoutSession.model'
import { User } from '../models/User.model'
import { calculateCalendarMetrics } from '../utils/calendarMetrics'

const WORKOUT_MILESTONES = [1, 10, 25, 50, 100]
const STREAK_MILESTONES = [3, 7, 12, 30, 100]

export interface PersonalBestInput {
  exerciseKey: string
  exerciseName: string
  weightUsedKg?: number
  repsCompleted?: number
}

interface AchievementCandidate {
  userId: string
  achievementKey: string
  category: AchievementCategory
  value: number
  exerciseKey?: string
  exerciseName?: string
}

const keyValue = (value: number): string => String(value).replace('.', '_')

export const evaluateAchievements = async (
  userId: string,
  personalBests: PersonalBestInput[]
): Promise<IAchievementUnlock[]> => {
  const completedMatch = { userId, completedAt: { $ne: null } }
  const [workoutCount, completed, user] = await Promise.all([
    WorkoutSession.countDocuments(completedMatch),
    WorkoutSession.find(completedMatch).select('completedAt').lean(),
    User.findById(userId).select('timezone').lean(),
  ])
  const { bestStreakDays } = calculateCalendarMetrics(
    completed.map(session => session.completedAt as Date).filter(Boolean),
    user?.timezone ?? 'UTC'
  )

  const candidates: AchievementCandidate[] = [
    ...WORKOUT_MILESTONES
      .filter(value => workoutCount >= value)
      .map(value => ({
        userId,
        achievementKey: `workouts_${value}`,
        category: 'workout_count' as const,
        value,
      })),
    ...STREAK_MILESTONES
      .filter(value => bestStreakDays >= value)
      .map(value => ({
        userId,
        achievementKey: `streak_${value}`,
        category: 'streak' as const,
        value,
      })),
    ...personalBests.flatMap(best => {
      const records: AchievementCandidate[] = []
      if (best.weightUsedKg !== undefined) {
        records.push({
          userId,
          achievementKey: `personal_record_${best.exerciseKey}_weight_${keyValue(best.weightUsedKg)}`,
          category: 'personal_record',
          value: best.weightUsedKg,
          exerciseKey: best.exerciseKey,
          exerciseName: best.exerciseName,
        })
      }
      if (best.repsCompleted !== undefined) {
        records.push({
          userId,
          achievementKey: `personal_record_${best.exerciseKey}_reps_${best.repsCompleted}`,
          category: 'personal_record',
          value: best.repsCompleted,
          exerciseKey: best.exerciseKey,
          exerciseName: best.exerciseName,
        })
      }
      return records
    }),
  ]

  const uniqueCandidates = [...new Map(
    candidates.map(candidate => [candidate.achievementKey, candidate])
  ).values()]
  if (uniqueCandidates.length === 0) return []

  const existing = await AchievementUnlock.find({
    userId,
    achievementKey: { $in: uniqueCandidates.map(candidate => candidate.achievementKey) },
  }).select('achievementKey').lean()
  const existingKeys = new Set(existing.map(item => item.achievementKey))
  const newUnlocks = uniqueCandidates.filter(candidate => !existingKeys.has(candidate.achievementKey))

  return newUnlocks.length > 0
    ? AchievementUnlock.insertMany(newUnlocks, { ordered: false })
    : []
}

export const listAchievements = async (
  userId: string,
  category?: AchievementCategory,
  limit = 20
): Promise<IAchievementUnlock[]> => {
  const categories: AchievementCategory[] = ['workout_count', 'streak', 'personal_record']
  if (category && !categories.includes(category)) throw new Error('INVALID_ACHIEVEMENT_FILTERS')
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('INVALID_ACHIEVEMENT_FILTERS')
  }
  const query = category ? { userId, category } : { userId }
  return AchievementUnlock.find(query).sort({ unlockedAt: -1 }).limit(limit)
}
