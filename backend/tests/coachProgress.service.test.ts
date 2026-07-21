jest.mock('../src/models/AchievementUnlock.model')
jest.mock('../src/models/ProgressGoal.model')
jest.mock('../src/models/User.model')
jest.mock('../src/models/WorkoutSession.model')
jest.mock('../src/services/coach.service', () => ({ requireCoachUser: jest.fn() }))

import { AchievementUnlock } from '../src/models/AchievementUnlock.model'
import { ProgressGoal } from '../src/models/ProgressGoal.model'
import { User } from '../src/models/User.model'
import { WorkoutSession } from '../src/models/WorkoutSession.model'
import { requireCoachUser } from '../src/services/coach.service'
import { getCoachProgressOverview } from '../src/services/coachProgress.service'

const mockRequireCoach = requireCoachUser as jest.MockedFunction<typeof requireCoachUser>
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
