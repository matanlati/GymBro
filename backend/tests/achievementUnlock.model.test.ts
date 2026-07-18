import { Types } from 'mongoose'
import { AchievementUnlock } from '../src/models/AchievementUnlock.model'

const userId = new Types.ObjectId()

describe('AchievementUnlock model', () => {
  it('accepts a workout-count milestone', async () => {
    const achievement = new AchievementUnlock({
      userId,
      achievementKey: 'workouts_50',
      category: 'workout_count',
      value: 50,
    })

    await expect(achievement.validate()).resolves.toBeUndefined()
    expect(achievement.unlockedAt).toBeInstanceOf(Date)
  })

  it('accepts a canonical personal-record achievement', async () => {
    const achievement = new AchievementUnlock({
      userId,
      achievementKey: 'personal_record_bench_press_100',
      category: 'personal_record',
      value: 100,
      exerciseKey: 'bench_press',
      exerciseName: 'Bench Press',
    })

    await expect(achievement.validate()).resolves.toBeUndefined()
  })

  it('requires exercise identity for personal-record achievements', async () => {
    const achievement = new AchievementUnlock({
      userId,
      achievementKey: 'personal_record_unknown',
      category: 'personal_record',
      value: 80,
    })

    await expect(achievement.validate()).rejects.toThrow(
      'exerciseKey and exerciseName are required for personal-record achievements'
    )
  })

  it('rejects a zero-value milestone', async () => {
    const achievement = new AchievementUnlock({
      userId,
      achievementKey: 'streak_0',
      category: 'streak',
      value: 0,
    })

    await expect(achievement.validate()).rejects.toThrow()
  })
})
