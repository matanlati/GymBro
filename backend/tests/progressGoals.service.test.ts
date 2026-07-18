jest.mock('../src/models/ProgressGoal.model')

import { ProgressGoal } from '../src/models/ProgressGoal.model'
import {
  createGoal,
  deleteGoal,
  updateGoal,
} from '../src/services/progressGoals.service'

const MockGoal = ProgressGoal as jest.Mocked<typeof ProgressGoal>

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
})
