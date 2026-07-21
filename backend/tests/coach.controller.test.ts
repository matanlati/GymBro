jest.mock('../src/services/coach.service')
jest.mock('../src/services/coachProgress.service', () => ({
  getCoachProgressOverview: jest.fn(),
  getTraineeProgressSummary: jest.fn(),
  getTraineeExerciseSeries: jest.fn(),
  listTraineeGoals: jest.fn(),
  listTraineeAchievements: jest.fn(),
  listTraineeMeasurements: jest.fn(),
}))

import { Response } from 'express'
import {
  getProgressOverview,
  getTraineeProgress,
  getTraineeProgressExercise,
  getTraineeProgressMeasurements,
} from '../src/controllers/coach.controller'
import {
  getCoachProgressOverview,
  getTraineeProgressSummary,
  listTraineeMeasurements,
} from '../src/services/coachProgress.service'
import { AuthRequest } from '../src/types'

const mockGetOverview = getCoachProgressOverview as jest.MockedFunction<typeof getCoachProgressOverview>
const mockGetSummary = getTraineeProgressSummary as jest.MockedFunction<typeof getTraineeProgressSummary>
const mockListMeasurements = listTraineeMeasurements as jest.MockedFunction<typeof listTraineeMeasurements>

const makeReq = (period?: unknown) => ({
  user: { userId: 'coach1', email: 'coach@example.com' },
  query: period === undefined ? {} : { period },
  params: { id: 'trainee1', name: 'Bench Press' },
} as unknown as AuthRequest)

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
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
