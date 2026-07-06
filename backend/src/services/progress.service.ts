import { Types } from 'mongoose'
import { WorkoutSession } from '../models/WorkoutSession.model'

// ── Public response shapes ──────────────────────────────────────────────────

export interface PersonalRecord {
  exerciseName: string
  maxWeightKg: number
  achievedAt: string
  daysTracked: number // distinct days this exercise was logged with weight
}

export interface ProgressSummary {
  totalSessions: number
  totalVolumeKg: number
  currentStreakDays: number
  personalRecords: PersonalRecord[]
}

export interface ExercisePoint {
  date: string // YYYY-MM-DD
  maxWeightKg: number
  totalVolumeKg: number
}

export interface HistoryItem {
  sessionId: string
  scheduledDate: string
  completedAt: string
  dayIndex: number
  exerciseCount: number
  totalVolumeKg: number
}

export interface HistoryPage {
  items: HistoryItem[]
  page: number
  limit: number
  total: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// Only completed sessions count toward progress metrics.
const completedMatch = (userId: string) => ({
  userId: new Types.ObjectId(userId),
  completedAt: { $ne: null },
})

const toDayKey = (d: Date): string => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.toISOString().slice(0, 10)
}

// Longest run of consecutive calendar days ending today (or yesterday), based on
// the set of days that have at least one completed session.
const computeStreak = (completedDates: Date[]): number => {
  if (completedDates.length === 0) return 0

  const dayKeys = new Set(completedDates.map(toDayKey))
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  // Allow the streak to still be "alive" if the user hasn't trained yet today.
  if (!dayKeys.has(toDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!dayKeys.has(toDayKey(cursor))) return 0
  }

  let streak = 0
  while (dayKeys.has(toDayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

// ── Queries ─────────────────────────────────────────────────────────────────

/**
 * Aggregate high-level progress metrics: session count, total lifted volume,
 * current training streak, and per-exercise personal records.
 */
export const getSummary = async (userId: string): Promise<ProgressSummary> => {
  const match = completedMatch(userId)

  const [totals] = await WorkoutSession.aggregate<{
    totalSessions: number
    totalVolumeKg: number
  }>([
    { $match: match },
    {
      $project: {
        volume: {
          $sum: {
            $map: {
              input: '$exercises',
              as: 'ex',
              in: {
                $sum: {
                  $map: {
                    input: '$$ex.sets',
                    as: 'set',
                    in: {
                      $multiply: [
                        { $ifNull: ['$$set.weightUsedKg', 0] },
                        { $ifNull: ['$$set.repsCompleted', 0] },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        totalVolumeKg: { $sum: '$volume' },
      },
    },
  ])

  const personalRecords = await WorkoutSession.aggregate<PersonalRecord>([
    { $match: match },
    { $unwind: '$exercises' },
    { $unwind: '$exercises.sets' },
    { $match: { 'exercises.sets.weightUsedKg': { $gt: 0 } } },
    {
      $group: {
        _id: '$exercises.name',
        maxWeightKg: { $max: '$exercises.sets.weightUsedKg' },
        achievedAt: { $max: '$completedAt' },
        // Distinct calendar days this exercise was actually trained with weight.
        days: {
          $addToSet: {
            $dateToString: { format: '%Y-%m-%d', date: '$scheduledDate' },
          },
        },
      },
    },
    // Only surface exercises with a plottable trend (trained on 2+ days).
    { $match: { $expr: { $gte: [{ $size: '$days' }, 2] } } },
    { $sort: { maxWeightKg: -1 } },
    {
      $project: {
        _id: 0,
        exerciseName: '$_id',
        maxWeightKg: 1,
        achievedAt: 1,
        daysTracked: { $size: '$days' },
      },
    },
  ])

  // Streak needs one lightweight pass over completed dates.
  const completed = await WorkoutSession.find(match).select('completedAt').lean()
  const currentStreakDays = computeStreak(
    completed.map(s => s.completedAt as Date).filter(Boolean)
  )

  return {
    totalSessions: totals?.totalSessions ?? 0,
    totalVolumeKg: Math.round(totals?.totalVolumeKg ?? 0),
    currentStreakDays,
    personalRecords,
  }
}

/**
 * Time series for a single exercise: max weight and total volume per day,
 * across all of the user's completed sessions.
 */
export const getExerciseSeries = async (
  userId: string,
  exerciseName: string
): Promise<ExercisePoint[]> => {
  return WorkoutSession.aggregate<ExercisePoint>([
    { $match: completedMatch(userId) },
    { $unwind: '$exercises' },
    { $match: { 'exercises.name': exerciseName } },
    { $unwind: '$exercises.sets' },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$scheduledDate' } },
        maxWeightKg: { $max: { $ifNull: ['$exercises.sets.weightUsedKg', 0] } },
        totalVolumeKg: {
          $sum: {
            $multiply: [
              { $ifNull: ['$exercises.sets.weightUsedKg', 0] },
              { $ifNull: ['$exercises.sets.repsCompleted', 0] },
            ],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: '$_id',
        maxWeightKg: 1,
        totalVolumeKg: { $round: ['$totalVolumeKg', 0] },
      },
    },
  ])
}

/**
 * Paginated list of completed sessions with a per-session volume roll-up,
 * newest first. Offset-based pagination (PLAN §8).
 */
export const getHistory = async (
  userId: string,
  page = 1,
  limit = 20
): Promise<HistoryPage> => {
  const safePage = Math.max(1, page)
  const safeLimit = Math.min(Math.max(1, limit), 100)
  const match = completedMatch(userId)

  const total = await WorkoutSession.countDocuments(match)

  const items = await WorkoutSession.aggregate<HistoryItem>([
    { $match: match },
    { $sort: { scheduledDate: -1 } },
    { $skip: (safePage - 1) * safeLimit },
    { $limit: safeLimit },
    {
      $project: {
        _id: 0,
        sessionId: { $toString: '$_id' },
        scheduledDate: 1,
        completedAt: 1,
        dayIndex: 1,
        exerciseCount: { $size: '$exercises' },
        totalVolumeKg: {
          $round: [
            {
              $sum: {
                $map: {
                  input: '$exercises',
                  as: 'ex',
                  in: {
                    $sum: {
                      $map: {
                        input: '$$ex.sets',
                        as: 'set',
                        in: {
                          $multiply: [
                            { $ifNull: ['$$set.weightUsedKg', 0] },
                            { $ifNull: ['$$set.repsCompleted', 0] },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
            0,
          ],
        },
      },
    },
  ])

  return { items, page: safePage, limit: safeLimit, total }
}
