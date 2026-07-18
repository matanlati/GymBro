jest.mock('../src/models/BodyMeasurement.model')
jest.mock('../src/models/User.model')

import { BodyMeasurement } from '../src/models/BodyMeasurement.model'
import { User } from '../src/models/User.model'
import {
  createMeasurement,
  deleteMeasurement,
  listMeasurements,
} from '../src/services/bodyMeasurements.service'

const MockMeasurement = BodyMeasurement as jest.Mocked<typeof BodyMeasurement>
const MockUser = User as jest.Mocked<typeof User>

const mockLatestWeight = (weightKg = 78) => {
  ;(MockMeasurement.findOne as jest.Mock) = jest.fn().mockReturnValue({
    sort: jest.fn().mockResolvedValue({ weightKg }),
  })
  ;(MockUser.findByIdAndUpdate as jest.Mock) = jest.fn().mockResolvedValue({})
}

describe('bodyMeasurements.service', () => {
  beforeEach(() => jest.clearAllMocks())

  it('creates a measurement and syncs the newest weight to the user', async () => {
    ;(MockMeasurement.create as jest.Mock) = jest.fn().mockImplementation(async value => value)
    mockLatestWeight(78.4)

    await createMeasurement('user1', { weightKg: 78.4 })

    expect(MockUser.findByIdAndUpdate).toHaveBeenCalledWith(
      'user1',
      { $set: { weightKg: 78.4 } }
    )
  })

  it('rejects an empty measurement', async () => {
    await expect(createMeasurement('user1', {})).rejects.toThrow(
      'INVALID_MEASUREMENT_PAYLOAD'
    )
  })

  it('builds a bounded date-range history query', async () => {
    const limit = jest.fn().mockResolvedValue([])
    const sort = jest.fn().mockReturnValue({ limit })
    ;(MockMeasurement.find as jest.Mock) = jest.fn().mockReturnValue({ sort })

    await listMeasurements('user1', {
      from: '2026-07-01',
      to: '2026-07-31',
      limit: 30,
    })

    expect(MockMeasurement.find).toHaveBeenCalledWith({
      userId: 'user1',
      measuredAt: {
        $gte: new Date('2026-07-01'),
        $lte: new Date('2026-07-31'),
      },
    })
    expect(limit).toHaveBeenCalledWith(30)
  })

  it('does not delete a measurement owned by another user', async () => {
    ;(MockMeasurement.deleteOne as jest.Mock) = jest.fn().mockResolvedValue({ deletedCount: 0 })

    await expect(deleteMeasurement('user1', 'measurement1')).rejects.toThrow(
      'MEASUREMENT_NOT_FOUND'
    )
  })
})
