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
import AiModelService from '../src/services/workoutPlan/AiModelService'
import RagRetrieverService from '../src/services/workoutPlan/RagRetrieverService'
import { ResponseValidator } from '../src/services/workoutPlan/ResponseValidator'
import { PromptBuilder, minExercisesPerDay } from '../src/services/workoutPlan/PromptBuilder'
import { WorkoutPlan as WorkoutPlanDTO } from '../src/types'

const MockWorkoutPlan = WorkoutPlan as jest.Mocked<typeof WorkoutPlan>
const MockAiModelService = AiModelService as jest.Mocked<typeof AiModelService>
const MockRagRetrieverService = RagRetrieverService as jest.Mocked<typeof RagRetrieverService>

const samplePlan: WorkoutPlanDTO = {
  summary: 'A balanced plan',
  weeklyPlan: [
    { day: 'Monday', focus: 'Push', exercises: [{ name: 'Bench', sets: '3', reps: '10' }] },
  ],
  safetyNotes: ['Warm up'],
  progressionNotes: 'Add 2.5kg weekly',
}

const retrievedExercise = {
  sourceId: 'exercise:dbpress',
  docType: 'exercise' as const,
  name: 'Dumbbell Bench Press',
  text: 'Dumbbell Bench Press. strength exercise targeting chest.',
  equipment: 'dumbbell',
  level: 'beginner',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps'],
  category: 'strength',
  mechanic: 'compound',
  instructions: [],
  score: 0.72,
}

const retrievedKnowledge = {
  ...retrievedExercise,
  sourceId: 'knowledge:trainingPrinciples:0',
  docType: 'knowledge' as const,
  name: 'trainingPrinciples/0',
  text: 'Progressive overload: gradually increase weight, reps, or intensity.',
  primaryMuscles: [],
}

describe('WorkoutPlanService.generatePlan', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    MockRagRetrieverService.retrieve.mockResolvedValue({
      exercises: [retrievedExercise],
      knowledge: [retrievedKnowledge],
      advisories: [],
      conditions: [],
    })
  })

  it('passes the full questionnaire to retrieval, not a flattened string', async () => {
    MockAiModelService.generateResponse.mockResolvedValue(JSON.stringify(samplePlan))
    const questionnaire = {
      trainingDays: 1,
      fitnessGoal: 'muscle_gain',
      trainingLevel: 'beginner',
      equipmentAvailable: 'Dumbbells',
    }

    await WorkoutPlanService.generatePlan(questionnaire)

    expect(MockRagRetrieverService.retrieve).toHaveBeenCalledWith(questionnaire)
  })

  it('puts the retrieved shortlist into the prompt', async () => {
    MockAiModelService.generateResponse.mockResolvedValue(JSON.stringify(samplePlan))

    await WorkoutPlanService.generatePlan({ trainingDays: 1 })

    const prompt = MockAiModelService.generateResponse.mock.calls[0][0]
    expect(prompt).toContain('Candidate Exercises')
    expect(prompt).toContain('Dumbbell Bench Press')
    expect(prompt).toContain('Progressive overload')
  })

  it('still generates a plan when retrieval degrades to empty', async () => {
    MockRagRetrieverService.retrieve.mockResolvedValue({
      exercises: [],
      knowledge: [],
      advisories: [],
      conditions: [],
      degradedReason: 'ECONNREFUSED',
    })
    MockAiModelService.generateResponse.mockResolvedValue(JSON.stringify(samplePlan))

    const result = await WorkoutPlanService.generatePlan({ trainingDays: 1 })

    expect(result).toEqual(samplePlan)
    const prompt = MockAiModelService.generateResponse.mock.calls[0][0]
    expect(prompt).not.toContain('Candidate Exercises')
  })

  it('retries once when the model includes an invalid rest-day entry', async () => {
    const invalidPlan = JSON.stringify({
      ...samplePlan,
      weeklyPlan: [
        ...samplePlan.weeklyPlan,
        { day: 'Wednesday (Rest Day)' },
      ],
    })
    MockAiModelService.generateResponse
      .mockResolvedValueOnce(invalidPlan)
      .mockResolvedValueOnce(JSON.stringify(samplePlan))

    const result = await WorkoutPlanService.generatePlan({ trainingDays: 1 })

    expect(result).toEqual(samplePlan)
    expect(MockAiModelService.generateResponse).toHaveBeenCalledTimes(2)
    expect(MockAiModelService.generateResponse.mock.calls[1][0]).toContain(
      'Do not include entries such as { "day": "Wednesday (Rest Day)" }.'
    )
  })
})

describe('ResponseValidator.validate', () => {
  it('fills sets and reps for duration-based exercises when the model omits them', () => {
    const plan = ResponseValidator.validate(JSON.stringify({
      ...samplePlan,
      weeklyPlan: [{
        day: 'Monday',
        focus: 'Core',
        exercises: [{ name: 'Plank', durationMinutes: '5' }],
      }],
    }))

    expect(plan.weeklyPlan[0].exercises[0]).toEqual({
      name: 'Plank',
      sets: '1',
      reps: 'N/A',
      durationMinutes: '5',
      notes: undefined,
    })
  })

  it('omits blank optional exercise fields returned by the model', () => {
    const plan = ResponseValidator.validate(JSON.stringify({
      ...samplePlan,
      weeklyPlan: [{
        day: 'Monday',
        focus: 'Push',
        exercises: [{
          name: 'Bench',
          sets: '3',
          reps: '10',
          notes: '',
          durationMinutes: '   ',
        }],
      }],
    }))

    expect(plan.weeklyPlan[0].exercises[0]).toEqual({
      name: 'Bench',
      sets: '3',
      reps: '10',
      notes: undefined,
      durationMinutes: undefined,
    })
  })

  it('normalizes numeric set and rep values returned by the model', () => {
    const plan = ResponseValidator.validate(JSON.stringify({
      ...samplePlan,
      weeklyPlan: [{
        day: 'Monday',
        focus: 'Push',
        exercises: [{ name: 'Bench', sets: 3, reps: 10, durationMinutes: 5 }],
      }],
    }))

    expect(plan.weeklyPlan[0].exercises[0]).toEqual({
      name: 'Bench',
      sets: '3',
      reps: '10',
      durationMinutes: '5',
      notes: undefined,
    })
  })

  it('still rejects invalid optional exercise field types', () => {
    expect(() => ResponseValidator.validate(JSON.stringify({
      ...samplePlan,
      weeklyPlan: [{
        day: 'Monday',
        focus: 'Push',
        exercises: [{ name: 'Bench', sets: '3', reps: '10', notes: ['bad'] }],
      }],
    }))).toThrow('notes must be a non-empty string when provided')
  })

  it('rejects normal exercises that omit reps', () => {
    expect(() => ResponseValidator.validate(JSON.stringify({
      ...samplePlan,
      weeklyPlan: [{
        day: 'Monday',
        focus: 'Push',
        exercises: [{ name: 'Bench', sets: '3' }],
      }],
    }))).toThrow('weeklyPlan[0].exercises[0].reps must be a non-empty string')
  })

  it('rejects empty weekly plans and empty exercise lists', () => {
    expect(() => ResponseValidator.validate(JSON.stringify({
      ...samplePlan,
      weeklyPlan: [],
    }))).toThrow('weeklyPlan must be a non-empty array')

    expect(() => ResponseValidator.validate(JSON.stringify({
      ...samplePlan,
      weeklyPlan: [{ day: 'Monday', focus: 'Push', exercises: [] }],
    }))).toThrow('weeklyPlan[0].exercises must be a non-empty array')
  })

  it('rejects safety notes that are not strings', () => {
    expect(() => ResponseValidator.validate(JSON.stringify({
      ...samplePlan,
      safetyNotes: ['Warm up', { text: 'bad' }],
    }))).toThrow('safetyNotes[1] must be a non-empty string')
  })

  it('enforces the expected number of training days when provided', () => {
    expect(() => ResponseValidator.validate(JSON.stringify(samplePlan), 2)).toThrow(
      'weeklyPlan must contain exactly 2 workout days'
    )
  })
})

describe('WorkoutPlanService.saveGeneratedPlan', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(MockWorkoutPlan.deleteMany as jest.Mock) = jest.fn().mockResolvedValue({})
    ;(MockWorkoutPlan.create as jest.Mock) = jest.fn().mockImplementation(async doc => ({
      _id: 'plan1',
      ...doc,
    }))
  })

  it('deletes the previous active plan after creating its replacement', async () => {
    await WorkoutPlanService.saveGeneratedPlan('user1', samplePlan)

    expect(MockWorkoutPlan.deleteMany).toHaveBeenCalledWith({
      userId: 'user1',
      isActive: true,
      _id: { $ne: 'plan1' },
    })
    const createOrder = (MockWorkoutPlan.create as jest.Mock).mock.invocationCallOrder[0]
    const deleteOrder = (MockWorkoutPlan.deleteMany as jest.Mock).mock.invocationCallOrder[0]
    expect(createOrder).toBeLessThan(deleteOrder)
  })

  it('creates the new plan with isActive: true', async () => {
    await WorkoutPlanService.saveGeneratedPlan('user1', samplePlan)

    const createArg = (MockWorkoutPlan.create as jest.Mock).mock.calls[0][0]
    expect(createArg.isActive).toBe(true)
    expect(createArg.userId).toBe('user1')
    expect(createArg.summary).toBe('A balanced plan')
    expect(createArg.weeklyPlan).toEqual([
      {
        day: 'Monday',
        focus: 'Push',
        exercises: [{ exerciseKey: 'bench', name: 'Bench', sets: '3', reps: '10' }],
      },
    ])
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

describe('per-day exercise minimum', () => {
  const dayWith = (count: number, extra: object[] = []) => ({
    day: 'Monday',
    focus: 'Full body',
    exercises: [
      ...Array.from({ length: count }, (_, i) => ({ name: `Ex${i}`, sets: '3', reps: '10' })),
      ...extra,
    ],
  })

  it('defaults the minimum by training level', () => {
    expect(minExercisesPerDay('beginner')).toBe(5)
    expect(minExercisesPerDay('intermediate')).toBe(6)
    expect(minExercisesPerDay('advanced')).toBe(7)
    expect(minExercisesPerDay(undefined)).toBe(5)
  })

  it('rejects a day with too few main exercises', () => {
    expect(() => ResponseValidator.validate(
      JSON.stringify({ ...samplePlan, weeklyPlan: [dayWith(2)] }), 1, 5
    )).toThrow('must contain at least 5 main exercises, got 2')
  })

  it('accepts a day that meets the minimum', () => {
    const plan = ResponseValidator.validate(
      JSON.stringify({ ...samplePlan, weeklyPlan: [dayWith(5)] }), 1, 5
    )
    expect(plan.weeklyPlan[0].exercises).toHaveLength(5)
  })

  it('does not count warm-ups and cooldowns toward the minimum', () => {
    const warmup = { name: 'Warm-Up Jog', sets: '1', reps: 'N/A', durationMinutes: '5' }
    const cooldown = { name: 'Cool-Down Stretch', sets: '1', reps: 'N/A', durationMinutes: '5' }
    expect(() => ResponseValidator.validate(
      JSON.stringify({ ...samplePlan, weeklyPlan: [dayWith(4, [warmup, cooldown])] }), 1, 5
    )).toThrow('at least 5 main exercises, got 4')
  })

  it('stays backward compatible when no minimum is supplied', () => {
    const plan = ResponseValidator.validate(
      JSON.stringify({ ...samplePlan, weeklyPlan: [dayWith(2)] }), 1
    )
    expect(plan.weeklyPlan[0].exercises).toHaveLength(2)
  })

  it('tells the model the per-day minimum in the prompt', () => {
    const prompt = PromptBuilder.buildPrompt(
      { trainingDays: 3, trainingLevel: 'beginner' },
      { exercises: [], knowledge: [], advisories: [], conditions: [] }
    )
    expect(prompt).toContain('AT LEAST 5 main exercises')
  })

  it('retries when the first response has a thin day, then accepts the fix', async () => {
    jest.clearAllMocks()
    MockRagRetrieverService.retrieve.mockResolvedValue({
      exercises: [], knowledge: [], advisories: [], conditions: [],
    })
    MockAiModelService.generateResponse
      .mockResolvedValueOnce(JSON.stringify({ ...samplePlan, weeklyPlan: [dayWith(2)] }))
      .mockResolvedValueOnce(JSON.stringify({ ...samplePlan, weeklyPlan: [dayWith(6)] }))

    const result = await WorkoutPlanService.generatePlan({ trainingDays: 1, trainingLevel: 'beginner' })

    expect(result.weeklyPlan[0].exercises).toHaveLength(6)
    expect(MockAiModelService.generateResponse).toHaveBeenCalledTimes(2)
  })

  it('accepts a still-thin retry rather than failing generation outright', async () => {
    jest.clearAllMocks()
    MockRagRetrieverService.retrieve.mockResolvedValue({
      exercises: [], knowledge: [], advisories: [], conditions: [],
    })
    MockAiModelService.generateResponse
      .mockResolvedValueOnce(JSON.stringify({ ...samplePlan, weeklyPlan: [dayWith(2)] }))
      .mockResolvedValueOnce(JSON.stringify({ ...samplePlan, weeklyPlan: [dayWith(3)] }))

    const result = await WorkoutPlanService.generatePlan({ trainingDays: 1, trainingLevel: 'beginner' })

    expect(result.weeklyPlan[0].exercises).toHaveLength(3)
  })
})
