import { Types } from 'mongoose'
import { ProgressGoal } from '../src/models/ProgressGoal.model'

const userId = new Types.ObjectId()

describe('ProgressGoal model', () => {
  it('accepts a weekly workout goal with model defaults', async () => {
    const goal = new ProgressGoal({
      userId,
      type: 'weekly_workouts',
      targetValue: 4,
      unit: 'workouts',
    })

    await expect(goal.validate()).resolves.toBeUndefined()
    expect(goal.status).toBe('active')
    expect(goal.startsAt).toBeInstanceOf(Date)
  })

  it('requires an exercise identity for strength goals', async () => {
    const goal = new ProgressGoal({
      userId,
      type: 'exercise_strength',
      targetValue: 100,
      unit: 'kg',
    })

    await expect(goal.validate()).rejects.toThrow(
      'exerciseKey and exerciseName are required for strength goals'
    )
  })

  it('rejects a unit that does not match the goal type', async () => {
    const goal = new ProgressGoal({
      userId,
      type: 'weekly_workouts',
      targetValue: 4,
      unit: 'kg',
    })

    await expect(goal.validate()).rejects.toThrow('unit does not match the goal type')
  })

  it('accepts a canonical exercise strength goal', async () => {
    const goal = new ProgressGoal({
      userId,
      type: 'exercise_strength',
      exerciseKey: 'bench_press',
      exerciseName: 'Bench Press',
      baselineValue: 90,
      targetValue: 100,
      unit: 'kg',
    })

    await expect(goal.validate()).resolves.toBeUndefined()
  })
})
