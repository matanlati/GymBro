import { Types } from 'mongoose'
import { WorkoutSession } from '../models/WorkoutSession.model'
import { User } from '../models/User.model'
import { toExerciseKey } from '../utils/exerciseKey'
import { calculateCalendarMetrics, WeeklyActivity } from '../utils/calendarMetrics'

// ── Public response shapes ──────────────────────────────────────────────────

export interface PersonalRecord {
  exerciseKey: string
  exerciseName: string
  maxWeightKg: number
  achievedAt: string
  daysTracked: number // distinct days this exercise was logged with weight
}

export interface BodyweightRecord {
  exerciseKey: string
  exerciseName: string
  maxReps: number
  achievedAt: string
  daysTracked: number
}

export interface StrengthProgress {
  exerciseKey: string
  exerciseName: string
  currentEstimatedOneRepMaxKg: number
  improvementPercent: number
  latestWorkoutAt: string
  daysTracked: number
}

export interface ProgressSummary {
  totalSessions: number
  totalVolumeKg: number
  averageDurationMinutes: number
  currentStreakDays: number
  bestStreakDays: number
  weeklyActivity: WeeklyActivity[]
  personalRecords: PersonalRecord[]
  bodyweightRecords: BodyweightRecord[]
  strengthProgress: StrengthProgress[]
}

export interface ExercisePoint {
  date: string // YYYY-MM-DD
  maxWeightKg: number
  estimatedOneRepMaxKg: number
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
    averageDurationMinutes: number | null
  }>([
    { $match: match },
    {
      $project: {
        durationMinutes: {
          $cond: [
            { $ne: [{ $type: '$startedAt' }, 'missing'] },
            { $divide: [{ $subtract: ['$completedAt', '$startedAt'] }, 60_000] },
            null,
          ],
        },
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
        averageDurationMinutes: { $avg: '$durationMinutes' },
      },
    },
  ])

  const personalRecords = await WorkoutSession.aggregate<PersonalRecord>([
    { $match: match },
    { $unwind: '$exercises' },
    { $unwind: '$exercises.sets' },
    { $match: { 'exercises.sets.weightUsedKg': { $gt: 0 } } },
    { $sort: { 'exercises.sets.weightUsedKg': -1, completedAt: 1 } },
    {
      $group: {
        _id: { $ifNull: ['$exercises.exerciseKey', '$exercises.name'] },
        exerciseName: { $first: '$exercises.name' },
        maxWeightKg: { $first: '$exercises.sets.weightUsedKg' },
        achievedAt: { $first: '$completedAt' },
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
        exerciseKey: '$_id',
        exerciseName: 1,
        maxWeightKg: 1,
        achievedAt: 1,
        daysTracked: { $size: '$days' },
      },
    },
  ])

  const bodyweightRecords = await WorkoutSession.aggregate<BodyweightRecord>([
    { $match: match },
    { $unwind: '$exercises' },
    { $unwind: '$exercises.sets' },
    {
      $match: {
        'exercises.sets.weightUsedKg': { $not: { $gt: 0 } },
        'exercises.sets.repsCompleted': { $gt: 0 },
      },
    },
    { $sort: { 'exercises.sets.repsCompleted': -1, completedAt: 1 } },
    {
      $group: {
        _id: { $ifNull: ['$exercises.exerciseKey', '$exercises.name'] },
        exerciseName: { $first: '$exercises.name' },
        maxReps: { $first: '$exercises.sets.repsCompleted' },
        achievedAt: { $first: '$completedAt' },
        days: {
          $addToSet: {
            $dateToString: { format: '%Y-%m-%d', date: '$scheduledDate' },
          },
        },
      },
    },
    { $match: { $expr: { $gte: [{ $size: '$days' }, 2] } } },
    { $sort: { maxReps: -1 } },
    {
      $project: {
        _id: 0,
        exerciseKey: '$_id',
        exerciseName: 1,
        maxReps: 1,
        achievedAt: 1,
        daysTracked: { $size: '$days' },
      },
    },
  ])

  const strengthProgress = await WorkoutSession.aggregate<StrengthProgress>([
    { $match: match },
    { $unwind: '$exercises' },
    { $unwind: '$exercises.sets' },
    {
      $match: {
        'exercises.sets.weightUsedKg': { $gt: 0 },
        'exercises.sets.repsCompleted': { $gt: 0 },
      },
    },
    {
      $project: {
        exerciseKey: { $ifNull: ['$exercises.exerciseKey', '$exercises.name'] },
        exerciseName: '$exercises.name',
        date: { $dateToString: { format: '%Y-%m-%d', date: '$scheduledDate' } },
        completedAt: 1,
        estimatedOneRepMaxKg: {
          $multiply: [
            '$exercises.sets.weightUsedKg',
            { $add: [1, { $divide: ['$exercises.sets.repsCompleted', 30] }] },
          ],
        },
      },
    },
    { $sort: { completedAt: 1 } },
    {
      $group: {
        _id: { exerciseKey: '$exerciseKey', date: '$date' },
        exerciseName: { $last: '$exerciseName' },
        estimatedOneRepMaxKg: { $max: '$estimatedOneRepMaxKg' },
        completedAt: { $max: '$completedAt' },
      },
    },
    { $sort: { completedAt: 1 } },
    {
      $group: {
        _id: '$_id.exerciseKey',
        exerciseName: { $last: '$exerciseName' },
        firstEstimatedOneRepMaxKg: { $first: '$estimatedOneRepMaxKg' },
        currentEstimatedOneRepMaxKg: { $last: '$estimatedOneRepMaxKg' },
        latestWorkoutAt: { $last: '$completedAt' },
        daysTracked: { $sum: 1 },
      },
    },
    { $match: { daysTracked: { $gte: 2 } } },
    {
      $project: {
        _id: 0,
        exerciseKey: '$_id',
        exerciseName: 1,
        currentEstimatedOneRepMaxKg: { $round: ['$currentEstimatedOneRepMaxKg', 1] },
        improvementPercent: {
          $round: [
            {
              $multiply: [
                {
                  $divide: [
                    { $subtract: ['$currentEstimatedOneRepMaxKg', '$firstEstimatedOneRepMaxKg'] },
                    '$firstEstimatedOneRepMaxKg',
                  ],
                },
                100,
              ],
            },
            1,
          ],
        },
        latestWorkoutAt: 1,
        daysTracked: 1,
      },
    },
    { $sort: { currentEstimatedOneRepMaxKg: -1 } },
  ])

  const [completed, user] = await Promise.all([
    WorkoutSession.find(match).select('completedAt').lean(),
    User.findById(userId).select('timezone').lean(),
  ])
  const calendarMetrics = calculateCalendarMetrics(
    completed.map(s => s.completedAt as Date).filter(Boolean),
    user?.timezone ?? 'UTC'
  )

  return {
    totalSessions: totals?.totalSessions ?? 0,
    totalVolumeKg: Math.round(totals?.totalVolumeKg ?? 0),
    averageDurationMinutes: Math.round(totals?.averageDurationMinutes ?? 0),
    currentStreakDays: calendarMetrics.currentStreakDays,
    bestStreakDays: calendarMetrics.bestStreakDays,
    weeklyActivity: calendarMetrics.weeklyActivity,
    personalRecords,
    bodyweightRecords,
    strengthProgress,
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
  const exerciseKey = toExerciseKey(exerciseName)

  return WorkoutSession.aggregate<ExercisePoint>([
    { $match: completedMatch(userId) },
    { $unwind: '$exercises' },
    {
      $match: {
        $or: [
          { 'exercises.exerciseKey': exerciseKey },
          { 'exercises.name': exerciseName },
        ],
      },
    },
    { $unwind: '$exercises.sets' },
    {
      $match: {
        'exercises.sets.weightUsedKg': { $gt: 0 },
        'exercises.sets.repsCompleted': { $gt: 0 },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$scheduledDate' } },
        maxWeightKg: { $max: { $ifNull: ['$exercises.sets.weightUsedKg', 0] } },
        estimatedOneRepMaxKg: {
          $max: {
            $multiply: [
              '$exercises.sets.weightUsedKg',
              { $add: [1, { $divide: ['$exercises.sets.repsCompleted', 30] }] },
            ],
          },
        },
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
        estimatedOneRepMaxKg: { $round: ['$estimatedOneRepMaxKg', 1] },
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
