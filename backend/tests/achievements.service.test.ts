jest.mock('../src/models/AchievementUnlock.model')
jest.mock('../src/models/WorkoutSession.model')
jest.mock('../src/models/User.model')

import { AchievementUnlock } from '../src/models/AchievementUnlock.model'
import { WorkoutSession } from '../src/models/WorkoutSession.model'
import { User } from '../src/models/User.model'
import { evaluateAchievements, listAchievements } from '../src/services/achievements.service'

const MockAchievement = AchievementUnlock as jest.Mocked<typeof AchievementUnlock>
const MockSession = WorkoutSession as jest.Mocked<typeof WorkoutSession>
const MockUser = User as jest.Mocked<typeof User>

describe('achievements.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(MockUser.findById as jest.Mock) = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ timezone: 'UTC' }),
      }),
    })
  })

  it('persists newly crossed workout, streak, and personal-record milestones', async () => {
    ;(MockSession.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(50)
    ;(MockSession.find as jest.Mock) = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(
          Array.from({ length: 12 }, (_, index) => ({
            completedAt: new Date(Date.UTC(2026, 6, index + 1, 12)),
          }))
        ),
      }),
    })
    ;(MockAchievement.find as jest.Mock) = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ achievementKey: 'workouts_1' }]),
      }),
    })
    ;(MockAchievement.insertMany as jest.Mock) = jest.fn().mockImplementation(async values => values)

    const result = await evaluateAchievements('user1', [{
      exerciseKey: 'bench_press',
      exerciseName: 'Bench Press',
      weightUsedKg: 100,
    }])

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ achievementKey: 'workouts_50', value: 50 }),
      expect.objectContaining({ achievementKey: 'streak_12', value: 12 }),
      expect.objectContaining({
        achievementKey: 'personal_record_bench_press_weight_100',
        exerciseKey: 'bench_press',
      }),
    ]))
    expect(result).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ achievementKey: 'workouts_1' }),
    ]))
  })

  it('returns achievement history newest first with a bounded limit', async () => {
    const limit = jest.fn().mockResolvedValue([])
    const sort = jest.fn().mockReturnValue({ limit })
    ;(MockAchievement.find as jest.Mock) = jest.fn().mockReturnValue({ sort })

    await listAchievements('user1', 'streak', 10)

    expect(MockAchievement.find).toHaveBeenCalledWith({ userId: 'user1', category: 'streak' })
    expect(sort).toHaveBeenCalledWith({ unlockedAt: -1 })
    expect(limit).toHaveBeenCalledWith(10)
  })

  it('allows an unlimited query for the full achievement history', async () => {
    const limit = jest.fn().mockResolvedValue([])
    const sort = jest.fn().mockReturnValue({ limit })
    ;(MockAchievement.find as jest.Mock) = jest.fn().mockReturnValue({ sort })

    await listAchievements('user1', undefined, 0)

    expect(MockAchievement.find).toHaveBeenCalledWith({ userId: 'user1' })
    expect(sort).toHaveBeenCalledWith({ unlockedAt: -1 })
    expect(limit).toHaveBeenCalledWith(0)
  })
})
