jest.mock('../src/models/AchievementUnlock.model')
jest.mock('../src/models/ProgressGoal.model')
jest.mock('../src/models/User.model')
jest.mock('../src/models/WorkoutSession.model')
jest.mock('../src/services/coach.service', () => ({
  requireCoachUser: jest.fn(),
  requireAssignedTrainee: jest.fn(),
}))
jest.mock('../src/services/achievements.service')
jest.mock('../src/services/bodyMeasurements.service')
jest.mock('../src/services/progress.service')
jest.mock('../src/services/progressGoals.service')

import { AchievementUnlock } from '../src/models/AchievementUnlock.model'
import { ProgressGoal } from '../src/models/ProgressGoal.model'
import { User } from '../src/models/User.model'
import { WorkoutSession } from '../src/models/WorkoutSession.model'
import * as achievementsService from '../src/services/achievements.service'
import * as bodyMeasurementsService from '../src/services/bodyMeasurements.service'
import { requireAssignedTrainee, requireCoachUser } from '../src/services/coach.service'
import {
  createTraineeGoal,
  deleteTraineeGoal,
  getCoachProgressOverview,
  getTraineeExerciseSeries,
  getTraineeProgressSummary,
  listTraineeAchievements,
  listTraineeGoals,
  listTraineeMeasurements,
  updateTraineeGoal,
} from '../src/services/coachProgress.service'
import * as progressService from '../src/services/progress.service'
import * as progressGoalsService from '../src/services/progressGoals.service'

const mockRequireCoach = requireCoachUser as jest.MockedFunction<typeof requireCoachUser>
const mockRequireAssigned = requireAssignedTrainee as jest.MockedFunction<typeof requireAssignedTrainee>
const MockUser = User as jest.Mocked<typeof User>
const MockSession = WorkoutSession as jest.Mocked<typeof WorkoutSession>
const MockAchievement = AchievementUnlock as jest.Mocked<typeof AchievementUnlock>
const MockGoal = ProgressGoal as jest.Mocked<typeof ProgressGoal>
const COACH_ID = '507f1f77bcf86cd799439011'
const TRAINEE_IDS = ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013']

const mockTrainees = (ids = TRAINEE_IDS) => {
  ;(MockUser.find as jest.Mock) = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(ids.map(_id => ({ _id }))),
    }),
  })
}

describe('coachProgress.service getCoachProgressOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireCoach.mockResolvedValue({
      _id: COACH_ID,
      role: 'coach',
      timezone: 'UTC',
    } as unknown as Awaited<ReturnType<typeof requireCoachUser>>)
    mockTrainees()
    ;(MockSession.countDocuments as jest.Mock) = jest.fn()
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(8)
    ;(MockAchievement.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(3)
    ;(MockGoal.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(2)
  })

  it('aggregates only currently assigned trainees for the selected calendar month', async () => {
    const result = await getCoachProgressOverview(
      COACH_ID,
      'month',
      new Date('2026-07-21T10:00:00.000Z')
    )

    expect(MockUser.find).toHaveBeenCalledWith({ coachId: COACH_ID, role: 'trainee' })
    expect(MockSession.countDocuments).toHaveBeenNthCalledWith(1, {
      userId: { $in: TRAINEE_IDS },
      completedAt: {
        $gte: new Date('2026-07-01T00:00:00.000Z'),
        $lt: new Date('2026-08-01T00:00:00.000Z'),
      },
    })
    expect(result).toEqual({
      period: 'month',
      range: {
        from: '2026-07-01T00:00:00.000Z',
        to: '2026-08-01T00:00:00.000Z',
      },
      completedWorkouts: { current: 12, previous: 8, changePercent: 50 },
      personalRecords: 3,
      goalsAchieved: 2,
    })
  })

  it('uses the coach timezone for calendar boundaries', async () => {
    mockRequireCoach.mockResolvedValue({
      _id: COACH_ID,
      role: 'coach',
      timezone: 'Asia/Jerusalem',
    } as unknown as Awaited<ReturnType<typeof requireCoachUser>>)

    const result = await getCoachProgressOverview(
      COACH_ID,
      'month',
      new Date('2026-07-21T10:00:00.000Z')
    )

    expect(result.range).toEqual({
      from: '2026-06-30T21:00:00.000Z',
      to: '2026-07-31T21:00:00.000Z',
    })
  })

  it('returns New as a null percentage when activity starts from zero', async () => {
    ;(MockSession.countDocuments as jest.Mock) = jest.fn()
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(0)

    const result = await getCoachProgressOverview(COACH_ID, 'week')

    expect(result.completedWorkouts.changePercent).toBeNull()
  })

  it('returns a zero change when both periods have no workouts', async () => {
    ;(MockSession.countDocuments as jest.Mock) = jest.fn()
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)

    const result = await getCoachProgressOverview(COACH_ID, 'quarter')

    expect(result.completedWorkouts.changePercent).toBe(0)
  })

  it('returns zero metrics without running metric queries when no trainees are assigned', async () => {
    mockTrainees([])

    const result = await getCoachProgressOverview(COACH_ID, 'year')

    expect(result.completedWorkouts).toEqual({ current: 0, previous: 0, changePercent: 0 })
    expect(result.personalRecords).toBe(0)
    expect(result.goalsAchieved).toBe(0)
    expect(MockSession.countDocuments).not.toHaveBeenCalled()
  })

  it('rejects unsupported periods before querying coach data', async () => {
    await expect(getCoachProgressOverview(COACH_ID, 'day')).rejects.toThrow('INVALID_PERIOD')
    expect(mockRequireCoach).not.toHaveBeenCalled()
  })
})

describe('coachProgress.service assigned trainee reads', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAssigned.mockResolvedValue({} as Awaited<ReturnType<typeof requireAssignedTrainee>>)
  })

  it('authorizes before loading the progress summary', async () => {
    const summary = { totalSessions: 4 }
    ;(progressService.getSummary as jest.Mock).mockResolvedValue(summary)

    await expect(getTraineeProgressSummary(COACH_ID, TRAINEE_IDS[0])).resolves.toBe(summary)

    expect(mockRequireAssigned).toHaveBeenCalledWith(COACH_ID, TRAINEE_IDS[0])
    expect(progressService.getSummary).toHaveBeenCalledWith(TRAINEE_IDS[0])
    expect(mockRequireAssigned.mock.invocationCallOrder[0])
      .toBeLessThan((progressService.getSummary as jest.Mock).mock.invocationCallOrder[0])
  })

  it('loads an exercise series for the assigned trainee', async () => {
    const series = [{ date: '2026-07-01', estimatedOneRepMaxKg: 80 }]
    ;(progressService.getExerciseSeries as jest.Mock).mockResolvedValue(series)

    await expect(
      getTraineeExerciseSeries(COACH_ID, TRAINEE_IDS[0], 'Bench Press')
    ).resolves.toBe(series)

    expect(progressService.getExerciseSeries).toHaveBeenCalledWith(
      TRAINEE_IDS[0],
      'Bench Press'
    )
  })

  it('forwards goal status after assignment authorization', async () => {
    ;(progressGoalsService.listGoals as jest.Mock).mockResolvedValue([])

    await listTraineeGoals(COACH_ID, TRAINEE_IDS[0], 'active')

    expect(progressGoalsService.listGoals).toHaveBeenCalledWith(TRAINEE_IDS[0], 'active')
  })

  it('forwards achievement filters after assignment authorization', async () => {
    ;(achievementsService.listAchievements as jest.Mock).mockResolvedValue([])

    await listTraineeAchievements(COACH_ID, TRAINEE_IDS[0], 'personal_record', 8)

    expect(achievementsService.listAchievements).toHaveBeenCalledWith(
      TRAINEE_IDS[0],
      'personal_record',
      8
    )
  })

  it('forwards measurement filters after assignment authorization', async () => {
    ;(bodyMeasurementsService.listMeasurements as jest.Mock).mockResolvedValue([])
    const filters = { from: '2026-01-01', to: '2026-07-31', limit: 50 }

    await listTraineeMeasurements(COACH_ID, TRAINEE_IDS[0], filters)

    expect(bodyMeasurementsService.listMeasurements).toHaveBeenCalledWith(
      TRAINEE_IDS[0],
      filters
    )
  })

  it('does not read trainee data when assignment authorization fails', async () => {
    mockRequireAssigned.mockRejectedValue(new Error('COACH_TRAINEE_NOT_FOUND'))

    await expect(getTraineeProgressSummary(COACH_ID, TRAINEE_IDS[0]))
      .rejects.toThrow('COACH_TRAINEE_NOT_FOUND')

    expect(progressService.getSummary).not.toHaveBeenCalled()
  })

  it('creates a goal for the assigned trainee', async () => {
    const payload = { type: 'weekly_workouts' as const, targetValue: 4 }
    const goal = { _id: 'goal1', ...payload }
    ;(progressGoalsService.createGoal as jest.Mock).mockResolvedValue(goal)

    await expect(createTraineeGoal(COACH_ID, TRAINEE_IDS[0], payload)).resolves.toBe(goal)

    expect(mockRequireAssigned).toHaveBeenCalledWith(COACH_ID, TRAINEE_IDS[0])
    expect(progressGoalsService.createGoal).toHaveBeenCalledWith(TRAINEE_IDS[0], payload)
  })

  it('updates a goal through the trainee-scoped goal service', async () => {
    const payload = { targetValue: 5, status: 'active' as const }
    ;(progressGoalsService.updateGoal as jest.Mock).mockResolvedValue({ _id: 'goal1' })

    await updateTraineeGoal(COACH_ID, TRAINEE_IDS[0], 'goal1', payload)

    expect(progressGoalsService.updateGoal).toHaveBeenCalledWith(
      TRAINEE_IDS[0],
      'goal1',
      payload
    )
  })

  it('deletes only a goal belonging to the assigned trainee', async () => {
    ;(progressGoalsService.deleteGoal as jest.Mock).mockResolvedValue(undefined)

    await deleteTraineeGoal(COACH_ID, TRAINEE_IDS[0], 'goal1')

    expect(progressGoalsService.deleteGoal).toHaveBeenCalledWith(TRAINEE_IDS[0], 'goal1')
  })

  it('does not mutate goals when assignment authorization fails', async () => {
    mockRequireAssigned.mockRejectedValue(new Error('COACH_TRAINEE_NOT_FOUND'))

    await expect(createTraineeGoal(COACH_ID, TRAINEE_IDS[0], {
      type: 'weekly_workouts',
      targetValue: 4,
    })).rejects.toThrow('COACH_TRAINEE_NOT_FOUND')

    expect(progressGoalsService.createGoal).not.toHaveBeenCalled()
    expect(progressGoalsService.updateGoal).not.toHaveBeenCalled()
    expect(progressGoalsService.deleteGoal).not.toHaveBeenCalled()
  })
})
