jest.mock('../src/models/WorkoutPlan.model')
jest.mock('../src/models/WorkoutSession.model')
jest.mock('../src/services/achievements.service', () => ({
  evaluateAchievements: jest.fn().mockResolvedValue([]),
}))

import { WorkoutPlan } from '../src/models/WorkoutPlan.model'
import { WorkoutSession } from '../src/models/WorkoutSession.model'
import {
  getOrCreateTodaySession,
  getSession,
  completeSession,
  logSet,
} from '../src/services/sessions.service'

const MockPlan = WorkoutPlan as jest.Mocked<typeof WorkoutPlan>
const MockSession = WorkoutSession as jest.Mocked<typeof WorkoutSession>

const activePlan = {
  _id: 'plan1',
  userId: 'user1',
  isActive: true,
  weeklyPlan: [
    { day: 'Monday', focus: 'Push', exercises: [{ name: 'Bench', sets: '3', reps: '8-12' }] },
    { day: 'Wednesday', focus: 'Pull', exercises: [{ name: 'Row', sets: '4', reps: '10' }] },
  ],
}

describe('sessions.service.getOrCreateTodaySession', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns an existing session when one matches (userId, planId, dayIndex, today)', async () => {
    const existing = { _id: 's1', dayIndex: 0 }
    ;(MockPlan.findOne as jest.Mock) = jest.fn().mockResolvedValue(activePlan)
    ;(MockSession.findOne as jest.Mock) = jest.fn().mockResolvedValue(existing)
    ;(MockSession.create as jest.Mock) = jest.fn()

    const result = await getOrCreateTodaySession('user1', 0)

    expect(result).toBe(existing)
    expect(MockSession.create).not.toHaveBeenCalled()
    const findArg = (MockSession.findOne as jest.Mock).mock.calls[0][0]
    expect(findArg.userId).toBe('user1')
    expect(findArg.planId).toBe('plan1')
    expect(findArg.dayIndex).toBe(0)
  })

  it('throws NO_ACTIVE_PLAN when the user has no active plan', async () => {
    ;(MockPlan.findOne as jest.Mock) = jest.fn().mockResolvedValue(null)
    await expect(getOrCreateTodaySession('user1', 0)).rejects.toThrow('NO_ACTIVE_PLAN')
  })

  it('throws INVALID_DAY_INDEX when dayIndex is out of range', async () => {
    ;(MockPlan.findOne as jest.Mock) = jest.fn().mockResolvedValue(activePlan)
    await expect(getOrCreateTodaySession('user1', 5)).rejects.toThrow('INVALID_DAY_INDEX')
  })

  it('builds new session exercises from the active plan day at dayIndex', async () => {
    ;(MockPlan.findOne as jest.Mock) = jest.fn().mockResolvedValue(activePlan)
    ;(MockSession.findOne as jest.Mock) = jest.fn().mockResolvedValue(null)
    ;(MockSession.create as jest.Mock) = jest.fn().mockImplementation(async doc => ({ _id: 's2', ...doc }))

    await getOrCreateTodaySession('user1', 1)

    const createArg = (MockSession.create as jest.Mock).mock.calls[0][0]
    expect(createArg.planId).toBe('plan1')
    expect(createArg.dayIndex).toBe(1)
    expect(createArg.startedAt).toBeInstanceOf(Date)
    expect(createArg.exercises).toEqual([
      { exerciseKey: 'row', name: 'Row', prescribedSets: '4', prescribedReps: '10', orderIndex: 0, sets: [] },
    ])
  })
})

describe('sessions.service.getSession', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws SESSION_NOT_FOUND when nothing matches', async () => {
    ;(MockSession.findById as jest.Mock) = jest.fn().mockResolvedValue(null)
    await expect(getSession('user1', 's1')).rejects.toThrow('SESSION_NOT_FOUND')
  })

  it('throws FORBIDDEN when the session belongs to another user', async () => {
    ;(MockSession.findById as jest.Mock) = jest.fn().mockResolvedValue({
      userId: { toString: () => 'other-user' },
    })
    await expect(getSession('user1', 's1')).rejects.toThrow('FORBIDDEN')
  })

  it('returns the session when the user owns it', async () => {
    const doc = { userId: { toString: () => 'user1' }, _id: 's1' }
    ;(MockSession.findById as jest.Mock) = jest.fn().mockResolvedValue(doc)
    expect(await getSession('user1', 's1')).toBe(doc)
  })
})

describe('sessions.service.completeSession', () => {
  beforeEach(() => jest.clearAllMocks())

  it('sets completedAt to a Date and saves', async () => {
    const save = jest.fn().mockImplementation(function (this: unknown) {
      return Promise.resolve(this)
    })
    const doc = { userId: { toString: () => 'user1' }, exercises: [], save } as Record<string, unknown>
    ;(MockSession.findById as jest.Mock) = jest.fn().mockResolvedValue(doc)

    await completeSession('user1', 's1')

    expect(doc.completedAt).toBeInstanceOf(Date)
    expect(save).toHaveBeenCalled()
  })

  it('throws FORBIDDEN when the user does not own the session', async () => {
    ;(MockSession.findById as jest.Mock) = jest.fn().mockResolvedValue({
      userId: { toString: () => 'other-user' },
      save: jest.fn(),
    })
    await expect(completeSession('user1', 's1')).rejects.toThrow('FORBIDDEN')
  })
})

describe('sessions.service.logSet', () => {
  beforeEach(() => jest.clearAllMocks())

  it('pushes a set with a server-assigned setNumber into the exercise', async () => {
    const save = jest.fn().mockImplementation(function (this: unknown) {
      return Promise.resolve(this)
    })
    const exercise = { name: 'Bench', sets: [{ setNumber: 1, repsCompleted: 10, loggedAt: new Date() }] }
    const doc = { userId: { toString: () => 'user1' }, exercises: [exercise], save }
    ;(MockSession.findById as jest.Mock) = jest.fn().mockResolvedValue(doc)

    await logSet('user1', 's1', 0, { repsCompleted: 8, weightUsedKg: 60 })

    expect(exercise.sets).toHaveLength(2)
    expect(exercise.sets[1]).toMatchObject({ setNumber: 2, repsCompleted: 8, weightUsedKg: 60 })
    expect(save).toHaveBeenCalled()
  })

  it('throws INVALID_EXERCISE_INDEX when the exercise index is out of range', async () => {
    const doc = { userId: { toString: () => 'user1' }, exercises: [], save: jest.fn() }
    ;(MockSession.findById as jest.Mock) = jest.fn().mockResolvedValue(doc)
    await expect(logSet('user1', 's1', 3, { repsCompleted: 8 })).rejects.toThrow('INVALID_EXERCISE_INDEX')
  })

  it('throws FORBIDDEN when the user does not own the session', async () => {
    ;(MockSession.findById as jest.Mock) = jest.fn().mockResolvedValue({
      userId: { toString: () => 'other-user' },
      exercises: [{ sets: [] }],
      save: jest.fn(),
    })
    await expect(logSet('user1', 's1', 0, { repsCompleted: 8 })).rejects.toThrow('FORBIDDEN')
  })
})
