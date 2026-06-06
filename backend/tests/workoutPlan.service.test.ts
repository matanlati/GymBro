jest.mock('../src/models/WorkoutPlan.model')
jest.mock('../src/services/workoutPlan/RagRetrieverService', () => ({
  __esModule: true,
  default: { retrieve: jest.fn() },
}))
jest.mock('../src/services/workoutPlan/AiModelService', () => ({
  __esModule: true,
  default: { generateResponse: jest.fn() },
}))

import { WorkoutPlan } from '../src/models/WorkoutPlan.model'
import WorkoutPlanService from '../src/services/workoutPlan/WorkoutPlanService'
import { WorkoutPlan as WorkoutPlanDTO } from '../src/types'

const MockWorkoutPlan = WorkoutPlan as jest.Mocked<typeof WorkoutPlan>

const samplePlan: WorkoutPlanDTO = {
  summary: 'A balanced plan',
  weeklyPlan: [
    { day: 'Monday', focus: 'Push', exercises: [{ name: 'Bench', sets: '3', reps: '10' }] },
  ],
  safetyNotes: ['Warm up'],
  progressionNotes: 'Add 2.5kg weekly',
}

describe('WorkoutPlanService.saveGeneratedPlan', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(MockWorkoutPlan.updateMany as jest.Mock) = jest.fn().mockResolvedValue({})
    ;(MockWorkoutPlan.create as jest.Mock) = jest.fn().mockImplementation(async doc => ({
      _id: 'plan1',
      ...doc,
    }))
  })

  it('deactivates existing plans before creating the new one', async () => {
    await WorkoutPlanService.saveGeneratedPlan('user1', samplePlan)

    expect(MockWorkoutPlan.updateMany).toHaveBeenCalledWith(
      { userId: 'user1' },
      { $set: { isActive: false } }
    )
    const updateOrder = (MockWorkoutPlan.updateMany as jest.Mock).mock.invocationCallOrder[0]
    const createOrder = (MockWorkoutPlan.create as jest.Mock).mock.invocationCallOrder[0]
    expect(updateOrder).toBeLessThan(createOrder)
  })

  it('creates the new plan with isActive: true', async () => {
    await WorkoutPlanService.saveGeneratedPlan('user1', samplePlan)

    const createArg = (MockWorkoutPlan.create as jest.Mock).mock.calls[0][0]
    expect(createArg.isActive).toBe(true)
    expect(createArg.userId).toBe('user1')
    expect(createArg.summary).toBe('A balanced plan')
    expect(createArg.weeklyPlan).toEqual(samplePlan.weeklyPlan)
  })

  it('derives a title from the first day focus when none is provided', async () => {
    await WorkoutPlanService.saveGeneratedPlan('user1', samplePlan)
    const createArg = (MockWorkoutPlan.create as jest.Mock).mock.calls[0][0]
    expect(createArg.title).toBe('Push Plan')
  })

  it('honors an explicit title when provided', async () => {
    await WorkoutPlanService.saveGeneratedPlan('user1', samplePlan, 'Summer Cut')
    const createArg = (MockWorkoutPlan.create as jest.Mock).mock.calls[0][0]
    expect(createArg.title).toBe('Summer Cut')
  })
})

describe('WorkoutPlanService.getActivePlan', () => {
  it('queries the active plan for the user', async () => {
    const fakeDoc = { _id: 'p1', userId: 'user1', isActive: true }
    ;(MockWorkoutPlan.findOne as jest.Mock) = jest.fn().mockResolvedValue(fakeDoc)

    const result = await WorkoutPlanService.getActivePlan('user1')

    expect(MockWorkoutPlan.findOne).toHaveBeenCalledWith({ userId: 'user1', isActive: true })
    expect(result).toBe(fakeDoc)
  })
})

describe('WorkoutPlanService.activatePlan', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(MockWorkoutPlan.updateMany as jest.Mock) = jest.fn().mockResolvedValue({})
  })

  it('throws PLAN_NOT_FOUND when the plan is missing', async () => {
    ;(MockWorkoutPlan.findById as jest.Mock) = jest.fn().mockResolvedValue(null)
    await expect(WorkoutPlanService.activatePlan('user1', 'p1')).rejects.toThrow('PLAN_NOT_FOUND')
  })

  it('throws FORBIDDEN when the plan belongs to another user', async () => {
    ;(MockWorkoutPlan.findById as jest.Mock) = jest.fn().mockResolvedValue({
      userId: { toString: () => 'other-user' },
      isActive: false,
      save: jest.fn(),
    })
    await expect(WorkoutPlanService.activatePlan('user1', 'p1')).rejects.toThrow('FORBIDDEN')
  })

  it('deactivates the user\'s other plans then activates the target', async () => {
    const save = jest.fn().mockImplementation(function (this: { isActive: boolean }) {
      return Promise.resolve(this)
    })
    const planDoc = {
      userId: { toString: () => 'user1' },
      isActive: false,
      save,
    }
    ;(MockWorkoutPlan.findById as jest.Mock) = jest.fn().mockResolvedValue(planDoc)

    const result = await WorkoutPlanService.activatePlan('user1', 'p1')

    expect(MockWorkoutPlan.updateMany).toHaveBeenCalledWith(
      { userId: 'user1' },
      { $set: { isActive: false } }
    )
    expect(planDoc.isActive).toBe(true)
    expect(save).toHaveBeenCalled()
    expect(result).toBe(planDoc)
  })
})

describe('WorkoutPlanService.deletePlan', () => {
  it('throws FORBIDDEN if the plan is owned by another user', async () => {
    ;(MockWorkoutPlan.findById as jest.Mock) = jest.fn().mockResolvedValue({
      userId: { toString: () => 'other-user' },
      deleteOne: jest.fn(),
    })
    await expect(WorkoutPlanService.deletePlan('user1', 'p1')).rejects.toThrow('FORBIDDEN')
  })

  it('calls deleteOne when the user owns the plan', async () => {
    const deleteOne = jest.fn().mockResolvedValue({})
    ;(MockWorkoutPlan.findById as jest.Mock) = jest.fn().mockResolvedValue({
      userId: { toString: () => 'user1' },
      deleteOne,
    })
    await WorkoutPlanService.deletePlan('user1', 'p1')
    expect(deleteOne).toHaveBeenCalled()
  })
})
