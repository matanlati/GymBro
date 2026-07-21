jest.mock('../src/services/coach.service')
jest.mock('../src/services/coachProgress.service', () => ({
  getCoachProgressOverview: jest.fn(),
  createTraineeGoal: jest.fn(),
  updateTraineeGoal: jest.fn(),
  deleteTraineeGoal: jest.fn(),
  getTraineeProgressSummary: jest.fn(),
  getTraineeExerciseSeries: jest.fn(),
  listTraineeGoals: jest.fn(),
  listTraineeAchievements: jest.fn(),
  listTraineeMeasurements: jest.fn(),
}))

import { Response } from 'express'
import {
  createTraineeProgressGoal,
  deleteTraineeProgressGoal,
  getProgressOverview,
  getTraineeProgress,
  getTraineeProgressExercise,
  getTraineeProgressMeasurements,
  updateTraineeProgressGoal,
} from '../src/controllers/coach.controller'
import {
  createTraineeGoal,
  deleteTraineeGoal,
  getCoachProgressOverview,
  getTraineeProgressSummary,
  listTraineeMeasurements,
  updateTraineeGoal,
} from '../src/services/coachProgress.service'
import { AuthRequest } from '../src/types'

const mockGetOverview = getCoachProgressOverview as jest.MockedFunction<typeof getCoachProgressOverview>
const mockGetSummary = getTraineeProgressSummary as jest.MockedFunction<typeof getTraineeProgressSummary>
const mockListMeasurements = listTraineeMeasurements as jest.MockedFunction<typeof listTraineeMeasurements>
const mockCreateGoal = createTraineeGoal as jest.MockedFunction<typeof createTraineeGoal>
const mockUpdateGoal = updateTraineeGoal as jest.MockedFunction<typeof updateTraineeGoal>
const mockDeleteGoal = deleteTraineeGoal as jest.MockedFunction<typeof deleteTraineeGoal>

const makeReq = (period?: unknown) => ({
  user: { userId: 'coach1', email: 'coach@example.com' },
  query: period === undefined ? {} : { period },
  params: { id: 'trainee1', name: 'Bench Press' },
} as unknown as AuthRequest)

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
} as unknown as Response)

describe('coach.controller getProgressOverview', () => {
  beforeEach(() => jest.clearAllMocks())

  it('defaults to the month period', async () => {
    const payload = { period: 'month' } as Awaited<ReturnType<typeof getCoachProgressOverview>>
    mockGetOverview.mockResolvedValue(payload)
    const res = makeRes()

    await getProgressOverview(makeReq(), res)

    expect(mockGetOverview).toHaveBeenCalledWith('coach1', 'month')
    expect(res.json).toHaveBeenCalledWith(payload)
  })

  it('passes a supported period to the service', async () => {
    const payload = { period: 'quarter' } as Awaited<ReturnType<typeof getCoachProgressOverview>>
    mockGetOverview.mockResolvedValue(payload)
    const res = makeRes()

    await getProgressOverview(makeReq('quarter'), res)

    expect(mockGetOverview).toHaveBeenCalledWith('coach1', 'quarter')
    expect(res.json).toHaveBeenCalledWith(payload)
  })

  it('maps an invalid period to a validation response', async () => {
    mockGetOverview.mockRejectedValue(new Error('INVALID_PERIOD'))
    const res = makeRes()

    await getProgressOverview(makeReq('day'), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'VALIDATION_ERROR',
      message: 'Period must be week, month, quarter, or year',
    })
  })
})

describe('coach.controller assigned trainee goal writes', () => {
  beforeEach(() => jest.clearAllMocks())

  it('creates a goal and responds with 201', async () => {
    const req = makeReq()
    req.body = { type: 'weekly_workouts', targetValue: 4 }
    const goal = { _id: 'goal1' }
    mockCreateGoal.mockResolvedValue(
      goal as unknown as Awaited<ReturnType<typeof createTraineeGoal>>
    )
    const res = makeRes()

    await createTraineeProgressGoal(req, res)

    expect(mockCreateGoal).toHaveBeenCalledWith('coach1', 'trainee1', req.body)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(goal)
  })

  it('updates a trainee goal', async () => {
    const req = makeReq()
    req.params.goalId = 'goal1'
    req.body = { targetValue: 5 }
    mockUpdateGoal.mockResolvedValue(
      { _id: 'goal1' } as unknown as Awaited<ReturnType<typeof updateTraineeGoal>>
    )
    const res = makeRes()

    await updateTraineeProgressGoal(req, res)

    expect(mockUpdateGoal).toHaveBeenCalledWith('coach1', 'trainee1', 'goal1', req.body)
  })

  it('deletes a trainee goal and responds with 204', async () => {
    const req = makeReq()
    req.params.goalId = 'goal1'
    mockDeleteGoal.mockResolvedValue(undefined)
    const res = makeRes()

    await deleteTraineeProgressGoal(req, res)

    expect(mockDeleteGoal).toHaveBeenCalledWith('coach1', 'trainee1', 'goal1')
    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.send).toHaveBeenCalled()
  })

  it('maps invalid goal input to a validation response', async () => {
    const req = makeReq()
    mockCreateGoal.mockRejectedValue(new Error('INVALID_GOAL_PAYLOAD'))
    const res = makeRes()

    await createTraineeProgressGoal(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'VALIDATION_ERROR',
      message: 'Invalid goal data',
    })
  })
})

describe('coach.controller assigned trainee progress reads', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns an assigned trainee progress summary', async () => {
    const summary = { totalSessions: 5 }
    mockGetSummary.mockResolvedValue(summary as Awaited<ReturnType<typeof getTraineeProgressSummary>>)
    const res = makeRes()

    await getTraineeProgress(makeReq(), res)

    expect(mockGetSummary).toHaveBeenCalledWith('coach1', 'trainee1')
    expect(res.json).toHaveBeenCalledWith(summary)
  })

  it('rejects an empty exercise name before calling the service', async () => {
    const req = makeReq()
    req.params.name = '   '
    const res = makeRes()

    await getTraineeProgressExercise(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('maps cross-coach access to not found', async () => {
    mockGetSummary.mockRejectedValue(new Error('COACH_TRAINEE_NOT_FOUND'))
    const res = makeRes()

    await getTraineeProgress(makeReq(), res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      error: 'TRAINEE_NOT_FOUND',
      message: 'This trainee is not assigned to you',
    })
  })

  it('passes parsed measurement filters to the service', async () => {
    mockListMeasurements.mockResolvedValue([])
    const req = makeReq()
    req.query = { from: '2026-01-01', to: '2026-07-31', limit: '25' }
    const res = makeRes()

    await getTraineeProgressMeasurements(req, res)

    expect(mockListMeasurements).toHaveBeenCalledWith('coach1', 'trainee1', {
      from: '2026-01-01',
      to: '2026-07-31',
      limit: 25,
    })
  })
})
