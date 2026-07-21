jest.mock('../src/services/coach.service')
jest.mock('../src/services/coachProgress.service', () => ({
  getCoachProgressOverview: jest.fn(),
}))

import { Response } from 'express'
import { getProgressOverview } from '../src/controllers/coach.controller'
import { getCoachProgressOverview } from '../src/services/coachProgress.service'
import { AuthRequest } from '../src/types'

const mockGetOverview = getCoachProgressOverview as jest.MockedFunction<typeof getCoachProgressOverview>

const makeReq = (period?: unknown) => ({
  user: { userId: 'coach1', email: 'coach@example.com' },
  query: period === undefined ? {} : { period },
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
