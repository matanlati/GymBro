import {
  ProgressGoal,
  ProgressGoalStatus,
  ProgressGoalType,
  ProgressGoalUnit,
  IProgressGoal,
} from '../models/ProgressGoal.model'
import { toExerciseKey } from '../utils/exerciseKey'
import { BodyMeasurement } from '../models/BodyMeasurement.model'
import { WorkoutSession } from '../models/WorkoutSession.model'
import { User } from '../models/User.model'
import { calculateCalendarMetrics } from '../utils/calendarMetrics'
import { Types } from 'mongoose'

const GOAL_TYPES: ProgressGoalType[] = [
  'weekly_workouts',
  'exercise_strength',
  'body_weight',
  'muscle_mass',
]
const GOAL_STATUSES: ProgressGoalStatus[] = ['active', 'completed', 'archived']
const UNIT_BY_TYPE: Record<ProgressGoalType, ProgressGoalUnit> = {
  weekly_workouts: 'workouts',
  exercise_strength: 'kg',
  body_weight: 'kg',
  muscle_mass: 'kg',
}

export interface CreateProgressGoalPayload {
  type: ProgressGoalType
  exerciseName?: string
  baselineValue?: number
  targetValue: number
  startsAt?: string | Date
  targetDate?: string | Date
}

export interface UpdateProgressGoalPayload {
  exerciseName?: string
  baselineValue?: number
  targetValue?: number
  targetDate?: string | Date
  status?: ProgressGoalStatus
}

export type ProgressGoalWithProgress = ReturnType<IProgressGoal['toObject']> & {
  currentValue: number | null
  progressPercent: number | null
}

const parseDate = (value: string | Date | undefined): Date | undefined => {
  if (value === undefined) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('INVALID_GOAL_PAYLOAD')
  return date
}

const requirePositiveTarget = (type: ProgressGoalType, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) throw new Error('INVALID_GOAL_PAYLOAD')
  if (type === 'weekly_workouts' && !Number.isInteger(value)) {
    throw new Error('INVALID_GOAL_PAYLOAD')
  }
}

export const listGoals = async (
  userId: string,
  status?: ProgressGoalStatus
): Promise<ProgressGoalWithProgress[]> => {
  if (status && !GOAL_STATUSES.includes(status)) throw new Error('INVALID_GOAL_STATUS')
  const query = status ? { userId, status } : { userId }
  const goals = await ProgressGoal.find(query).sort({ createdAt: -1 })

  const exerciseKeys = goals
    .filter(goal => goal.type === 'exercise_strength' && goal.exerciseKey)
    .map(goal => goal.exerciseKey as string)
  const completedMatch = {
    userId: new Types.ObjectId(userId),
    completedAt: { $ne: null },
  }

  const [completed, user, latestWeight, latestMuscleMass, strengthValues] = await Promise.all([
    WorkoutSession.find(completedMatch).select('completedAt').lean(),
    User.findById(userId).select('timezone').lean(),
    BodyMeasurement.findOne({ userId, weightKg: { $exists: true } }).sort({ measuredAt: -1 }),
    BodyMeasurement.findOne({ userId, muscleMassKg: { $exists: true } }).sort({ measuredAt: -1 }),
    exerciseKeys.length > 0
      ? WorkoutSession.aggregate<{ exerciseKey: string; currentValue: number }>([
          { $match: completedMatch },
          { $unwind: '$exercises' },
          { $match: { 'exercises.exerciseKey': { $in: exerciseKeys } } },
          { $unwind: '$exercises.sets' },
          {
            $match: {
              'exercises.sets.weightUsedKg': { $gt: 0 },
              'exercises.sets.repsCompleted': { $gt: 0 },
            },
          },
          {
            $project: {
              exerciseKey: '$exercises.exerciseKey',
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
              estimatedOneRepMaxKg: { $max: '$estimatedOneRepMaxKg' },
              completedAt: { $max: '$completedAt' },
            },
          },
          { $sort: { completedAt: 1 } },
          {
            $group: {
              _id: '$_id.exerciseKey',
              currentValue: { $last: '$estimatedOneRepMaxKg' },
            },
          },
          {
            $project: {
              _id: 0,
              exerciseKey: '$_id',
              currentValue: { $round: ['$currentValue', 1] },
            },
          },
        ])
      : Promise.resolve([]),
  ])

  const weeklyActivity = calculateCalendarMetrics(
    completed.map(session => session.completedAt as Date).filter(Boolean),
    user?.timezone ?? 'UTC'
  ).weeklyActivity
  const weeklyWorkouts = weeklyActivity[weeklyActivity.length - 1]?.workoutCount ?? 0
  const strengthByExercise = new Map(
    strengthValues.map(value => [value.exerciseKey, value.currentValue])
  )

  return goals.map(goal => {
    let currentValue: number | null = null
    if (goal.type === 'weekly_workouts') currentValue = weeklyWorkouts
    if (goal.type === 'exercise_strength' && goal.exerciseKey) {
      currentValue = strengthByExercise.get(goal.exerciseKey) ?? null
    }
    if (goal.type === 'body_weight') currentValue = latestWeight?.weightKg ?? null
    if (goal.type === 'muscle_mass') currentValue = latestMuscleMass?.muscleMassKg ?? null

    let baseline = goal.baselineValue
    if (goal.type === 'weekly_workouts' || goal.type === 'exercise_strength') baseline ??= 0
    let progressPercent: number | null = null
    if (goal.status === 'completed') {
      progressPercent = 100
    } else if (
      currentValue !== null &&
      baseline !== undefined &&
      goal.targetValue !== baseline
    ) {
      const raw = ((currentValue - baseline) / (goal.targetValue - baseline)) * 100
      progressPercent = Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10
    }

    return {
      ...goal.toObject(),
      currentValue,
      progressPercent,
    }
  })
}

export const createGoal = async (
  userId: string,
  payload: CreateProgressGoalPayload
): Promise<IProgressGoal> => {
  if (!GOAL_TYPES.includes(payload.type)) throw new Error('INVALID_GOAL_PAYLOAD')
  requirePositiveTarget(payload.type, payload.targetValue)

  const exerciseName = payload.exerciseName?.trim()
  if (payload.type === 'exercise_strength' && !exerciseName) {
    throw new Error('INVALID_GOAL_PAYLOAD')
  }
  if (payload.baselineValue !== undefined && (
    !Number.isFinite(payload.baselineValue) || payload.baselineValue < 0
  )) {
    throw new Error('INVALID_GOAL_PAYLOAD')
  }

  return ProgressGoal.create({
    userId,
    type: payload.type,
    exerciseKey: exerciseName ? toExerciseKey(exerciseName) : undefined,
    exerciseName,
    baselineValue: payload.baselineValue,
    targetValue: payload.targetValue,
    unit: UNIT_BY_TYPE[payload.type],
    startsAt: parseDate(payload.startsAt),
    targetDate: parseDate(payload.targetDate),
  })
}

export const updateGoal = async (
  userId: string,
  goalId: string,
  payload: UpdateProgressGoalPayload
): Promise<IProgressGoal> => {
  const goal = await ProgressGoal.findOne({ _id: goalId, userId })
  if (!goal) throw new Error('GOAL_NOT_FOUND')

  if (payload.targetValue !== undefined) {
    requirePositiveTarget(goal.type, payload.targetValue)
    goal.targetValue = payload.targetValue
  }
  if (payload.baselineValue !== undefined) {
    if (!Number.isFinite(payload.baselineValue) || payload.baselineValue < 0) {
      throw new Error('INVALID_GOAL_PAYLOAD')
    }
    goal.baselineValue = payload.baselineValue
  }
  if (payload.exerciseName !== undefined) {
    if (goal.type !== 'exercise_strength' || !payload.exerciseName.trim()) {
      throw new Error('INVALID_GOAL_PAYLOAD')
    }
    goal.exerciseName = payload.exerciseName.trim()
    goal.exerciseKey = toExerciseKey(goal.exerciseName)
  }
  if (payload.targetDate !== undefined) goal.targetDate = parseDate(payload.targetDate)
  if (payload.status !== undefined) {
    if (!GOAL_STATUSES.includes(payload.status)) throw new Error('INVALID_GOAL_STATUS')
    goal.status = payload.status
    goal.completedAt = payload.status === 'completed' ? new Date() : undefined
  }

  return goal.save()
}

export const deleteGoal = async (userId: string, goalId: string): Promise<void> => {
  const result = await ProgressGoal.deleteOne({ _id: goalId, userId })
  if (result.deletedCount === 0) throw new Error('GOAL_NOT_FOUND')
}
