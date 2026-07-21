import { AchievementUnlock } from '../models/AchievementUnlock.model'
import { AchievementCategory } from '../models/AchievementUnlock.model'
import { ProgressGoal } from '../models/ProgressGoal.model'
import { ProgressGoalStatus } from '../models/ProgressGoal.model'
import { User } from '../models/User.model'
import { WorkoutSession } from '../models/WorkoutSession.model'
import * as achievementsService from './achievements.service'
import * as bodyMeasurementsService from './bodyMeasurements.service'
import * as progressService from './progress.service'
import * as progressGoalsService from './progressGoals.service'
import { requireAssignedTrainee, requireCoachUser } from './coach.service'

export type CoachProgressPeriod = 'week' | 'month' | 'quarter' | 'year'

export interface CoachProgressOverview {
  period: CoachProgressPeriod
  range: { from: string; to: string }
  completedWorkouts: {
    current: number
    previous: number
    changePercent: number | null
  }
  personalRecords: number
  goalsAchieved: number
}

const PERIODS: CoachProgressPeriod[] = ['week', 'month', 'quarter', 'year']

interface DateParts {
  year: number
  month: number
  day: number
}

const zonedDateParts = (date: Date, timeZone: string): DateParts => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(part => part.type === type)?.value)
  return { year: value('year'), month: value('month'), day: value('day') }
}

const shiftLocalDays = (parts: DateParts, days: number): DateParts => {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}

const zonedMidnightToUtc = (parts: DateParts, timeZone: string): Date => {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day)
  let result = target

  // Re-evaluate once to account for offsets around daylight-saving boundaries.
  for (let index = 0; index < 2; index += 1) {
    const date = new Date(result)
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date)
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(formatted.find(part => part.type === type)?.value)
    const representedAsUtc = Date.UTC(
      value('year'),
      value('month') - 1,
      value('day'),
      value('hour'),
      value('minute'),
      value('second')
    )
    result = target - (representedAsUtc - date.getTime())
  }
  return new Date(result)
}

const periodLocalStarts = (
  period: CoachProgressPeriod,
  now: Date,
  timeZone: string
): { previous: DateParts; current: DateParts; next: DateParts } => {
  const today = zonedDateParts(now, timeZone)

  if (period === 'week') {
    const weekday = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay()
    const current = shiftLocalDays(today, -(weekday === 0 ? 6 : weekday - 1))
    return { previous: shiftLocalDays(current, -7), current, next: shiftLocalDays(current, 7) }
  }

  if (period === 'month') {
    const current = { year: today.year, month: today.month, day: 1 }
    const previousDate = new Date(Date.UTC(today.year, today.month - 2, 1))
    const nextDate = new Date(Date.UTC(today.year, today.month, 1))
    return {
      previous: { year: previousDate.getUTCFullYear(), month: previousDate.getUTCMonth() + 1, day: 1 },
      current,
      next: { year: nextDate.getUTCFullYear(), month: nextDate.getUTCMonth() + 1, day: 1 },
    }
  }

  if (period === 'quarter') {
    const startMonth = Math.floor((today.month - 1) / 3) * 3 + 1
    const current = { year: today.year, month: startMonth, day: 1 }
    const previousDate = new Date(Date.UTC(today.year, startMonth - 4, 1))
    const nextDate = new Date(Date.UTC(today.year, startMonth + 2, 1))
    return {
      previous: { year: previousDate.getUTCFullYear(), month: previousDate.getUTCMonth() + 1, day: 1 },
      current,
      next: { year: nextDate.getUTCFullYear(), month: nextDate.getUTCMonth() + 1, day: 1 },
    }
  }

  return {
    previous: { year: today.year - 1, month: 1, day: 1 },
    current: { year: today.year, month: 1, day: 1 },
    next: { year: today.year + 1, month: 1, day: 1 },
  }
}

export const getCoachProgressOverview = async (
  coachUserId: string,
  requestedPeriod: string,
  now = new Date()
): Promise<CoachProgressOverview> => {
  if (!PERIODS.includes(requestedPeriod as CoachProgressPeriod)) throw new Error('INVALID_PERIOD')
  const period = requestedPeriod as CoachProgressPeriod
  const coach = await requireCoachUser(coachUserId)
  const timeZone = coach.timezone || 'UTC'
  const localStarts = periodLocalStarts(period, now, timeZone)
  const previousStart = zonedMidnightToUtc(localStarts.previous, timeZone)
  const currentStart = zonedMidnightToUtc(localStarts.current, timeZone)
  const nextStart = zonedMidnightToUtc(localStarts.next, timeZone)

  const trainees = await User.find({ coachId: coach._id, role: 'trainee' }).select('_id').lean()
  const traineeIds = trainees.map(trainee => trainee._id)

  let current = 0
  let previous = 0
  let personalRecords = 0
  let goalsAchieved = 0

  if (traineeIds.length > 0) {
    ;[current, previous, personalRecords, goalsAchieved] = await Promise.all([
      WorkoutSession.countDocuments({
        userId: { $in: traineeIds },
        completedAt: { $gte: currentStart, $lt: nextStart },
      }),
      WorkoutSession.countDocuments({
        userId: { $in: traineeIds },
        completedAt: { $gte: previousStart, $lt: currentStart },
      }),
      AchievementUnlock.countDocuments({
        userId: { $in: traineeIds },
        category: 'personal_record',
        unlockedAt: { $gte: currentStart, $lt: nextStart },
      }),
      ProgressGoal.countDocuments({
        userId: { $in: traineeIds },
        status: 'completed',
        completedAt: { $gte: currentStart, $lt: nextStart },
      }),
    ])
  }

  const changePercent = previous === 0
    ? current === 0 ? 0 : null
    : Math.round(((current - previous) / previous) * 1000) / 10

  return {
    period,
    range: { from: currentStart.toISOString(), to: nextStart.toISOString() },
    completedWorkouts: { current, previous, changePercent },
    personalRecords,
    goalsAchieved,
  }
}

export const getTraineeProgressSummary = async (coachUserId: string, traineeId: string) => {
  await requireAssignedTrainee(coachUserId, traineeId)
  return progressService.getSummary(traineeId)
}

export const getTraineeExerciseSeries = async (
  coachUserId: string,
  traineeId: string,
  exerciseName: string
) => {
  await requireAssignedTrainee(coachUserId, traineeId)
  return progressService.getExerciseSeries(traineeId, exerciseName)
}

export const listTraineeGoals = async (
  coachUserId: string,
  traineeId: string,
  status?: ProgressGoalStatus
) => {
  await requireAssignedTrainee(coachUserId, traineeId)
  return progressGoalsService.listGoals(traineeId, status)
}

export const listTraineeAchievements = async (
  coachUserId: string,
  traineeId: string,
  category?: AchievementCategory,
  limit?: number
) => {
  await requireAssignedTrainee(coachUserId, traineeId)
  return achievementsService.listAchievements(traineeId, category, limit)
}

export const listTraineeMeasurements = async (
  coachUserId: string,
  traineeId: string,
  filters: bodyMeasurementsService.MeasurementFilters
) => {
  await requireAssignedTrainee(coachUserId, traineeId)
  return bodyMeasurementsService.listMeasurements(traineeId, filters)
}
