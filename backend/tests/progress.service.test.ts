jest.mock('../src/models/WorkoutSession.model')

import { WorkoutSession } from '../src/models/WorkoutSession.model'
import { getSummary } from '../src/services/progress.service'

const MockSession = WorkoutSession as jest.Mocked<typeof WorkoutSession>
const USER_ID = '507f1f77bcf86cd799439011'

describe('progress.service.getSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(MockSession.find as jest.Mock) = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    })
  })

  it('returns the rounded average duration reported by the summary aggregation', async () => {
    ;(MockSession.aggregate as jest.Mock) = jest.fn()
      .mockResolvedValueOnce([{
        totalSessions: 3,
        totalVolumeKg: 1250,
        averageDurationMinutes: 46.6,
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const summary = await getSummary(USER_ID)

    expect(summary.averageDurationMinutes).toBe(47)
  })

  it('returns zero when no completed session has timing data', async () => {
    ;(MockSession.aggregate as jest.Mock) = jest.fn()
      .mockResolvedValueOnce([{
        totalSessions: 2,
        totalVolumeKg: 0,
        averageDurationMinutes: null,
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const summary = await getSummary(USER_ID)

    expect(summary.averageDurationMinutes).toBe(0)
  })

  it('returns estimated strength progress from the aggregation', async () => {
    const strengthProgress = [{
      exerciseKey: 'bench_press',
      exerciseName: 'Bench Press',
      currentEstimatedOneRepMaxKg: 96.4,
      improvementPercent: 8.4,
      latestWorkoutAt: '2026-07-18T10:00:00.000Z',
      daysTracked: 6,
    }]
    ;(MockSession.aggregate as jest.Mock) = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(strengthProgress)

    const summary = await getSummary(USER_ID)

    expect(summary.strengthProgress).toEqual(strengthProgress)
  })
})
