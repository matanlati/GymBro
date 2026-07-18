jest.mock('../src/models/ProgressGoal.model')
jest.mock('../src/models/BodyMeasurement.model')
jest.mock('../src/models/WorkoutSession.model')
jest.mock('../src/models/User.model')

import { ProgressGoal } from '../src/models/ProgressGoal.model'
import { BodyMeasurement } from '../src/models/BodyMeasurement.model'
import { WorkoutSession } from '../src/models/WorkoutSession.model'
import { User } from '../src/models/User.model'
import {
  createGoal,
  deleteGoal,
  listGoals,
  updateGoal,
} from '../src/services/progressGoals.service'

const MockGoal = ProgressGoal as jest.Mocked<typeof ProgressGoal>
const MockMeasurement = BodyMeasurement as jest.Mocked<typeof BodyMeasurement>
const MockSession = WorkoutSession as jest.Mocked<typeof WorkoutSession>
const MockUser = User as jest.Mocked<typeof User>
const USER_ID = '507f1f77bcf86cd799439011'

describe('progressGoals.service', () => {
  beforeEach(() => jest.clearAllMocks())

  it('creates a strength goal with a server-derived key and unit', async () => {
    ;(MockGoal.create as jest.Mock) = jest.fn().mockImplementation(async value => value)

    await createGoal('user1', {
      type: 'exercise_strength',
      exerciseName: 'Barbell Bench Press',
      baselineValue: 90,
      targetValue: 100,
    })

    expect(MockGoal.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user1',
      exerciseKey: 'bench_press',
      exerciseName: 'Barbell Bench Press',
      unit: 'kg',
    }))
  })

  it('rejects a fractional weekly workout target', async () => {
    await expect(createGoal('user1', {
      type: 'weekly_workouts',
      targetValue: 3.5,
    })).rejects.toThrow('INVALID_GOAL_PAYLOAD')
  })

  it('sets completedAt when a goal is completed', async () => {
    const goal = {
      type: 'weekly_workouts',
      status: 'active',
      completedAt: undefined,
      save: jest.fn().mockImplementation(function (this: unknown) {
        return Promise.resolve(this)
      }),
    }
    ;(MockGoal.findOne as jest.Mock) = jest.fn().mockResolvedValue(goal)

    await updateGoal('user1', 'goal1', { status: 'completed' })

    expect(goal.status).toBe('completed')
    expect(goal.completedAt).toBeInstanceOf(Date)
    expect(goal.save).toHaveBeenCalled()
  })

  it('does not delete a goal owned by another user', async () => {
    ;(MockGoal.deleteOne as jest.Mock) = jest.fn().mockResolvedValue({ deletedCount: 0 })

    await expect(deleteGoal('user1', 'goal1')).rejects.toThrow('GOAL_NOT_FOUND')
    expect(MockGoal.deleteOne).toHaveBeenCalledWith({ _id: 'goal1', userId: 'user1' })
  })

  it('returns calculated progress for every goal type', async () => {
    const goal = (value: Record<string, unknown>) => ({
      status: 'active',
      toObject: () => value,
      ...value,
    })
    const goals = [
      goal({ type: 'weekly_workouts', targetValue: 4 }),
      goal({
        type: 'exercise_strength',
        exerciseKey: 'bench_press',
        baselineValue: 80,
        targetValue: 100,
      }),
      goal({ type: 'body_weight', baselineValue: 80, targetValue: 70 }),
      goal({ type: 'muscle_mass', baselineValue: 30, targetValue: 35 }),
    ]
    ;(MockGoal.find as jest.Mock) = jest.fn().mockReturnValue({
      sort: jest.fn().mockResolvedValue(goals),
    })
    ;(MockSession.find as jest.Mock) = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { completedAt: new Date() },
          { completedAt: new Date() },
        ]),
      }),
    })
    ;(MockSession.aggregate as jest.Mock) = jest.fn().mockResolvedValue([{
      exerciseKey: 'bench_press',
      currentValue: 90,
    }])
    ;(MockUser.findById as jest.Mock) = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ timezone: 'UTC' }),
      }),
    })
    ;(MockMeasurement.findOne as jest.Mock) = jest.fn()
      .mockReturnValueOnce({ sort: jest.fn().mockResolvedValue({ weightKg: 75 }) })
      .mockReturnValueOnce({ sort: jest.fn().mockResolvedValue({ muscleMassKg: 32.5 }) })

    const result = await listGoals(USER_ID, 'active')

    expect(result.map(item => ({
      currentValue: item.currentValue,
      progressPercent: item.progressPercent,
    }))).toEqual([
      { currentValue: 2, progressPercent: 50 },
      { currentValue: 90, progressPercent: 50 },
      { currentValue: 75, progressPercent: 50 },
      { currentValue: 32.5, progressPercent: 50 },
    ])
  })
})
