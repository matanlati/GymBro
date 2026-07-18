import {
  ProgressGoal,
  ProgressGoalStatus,
  ProgressGoalType,
  ProgressGoalUnit,
  IProgressGoal,
} from '../models/ProgressGoal.model'
import { toExerciseKey } from '../utils/exerciseKey'

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
): Promise<IProgressGoal[]> => {
  if (status && !GOAL_STATUSES.includes(status)) throw new Error('INVALID_GOAL_STATUS')
  const query = status ? { userId, status } : { userId }
  return ProgressGoal.find(query).sort({ createdAt: -1 })
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
