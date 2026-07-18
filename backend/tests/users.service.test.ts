jest.mock('../src/models/User.model')
jest.mock('../src/services/bodyMeasurements.service', () => ({
  createMeasurement: jest.fn(),
}))

import { User } from '../src/models/User.model'
import { createMeasurement } from '../src/services/bodyMeasurements.service'
import { updateMe } from '../src/services/users.service'

const MockUser = User as jest.Mocked<typeof User>
const mockCreateMeasurement = createMeasurement as jest.MockedFunction<typeof createMeasurement>

describe('users.service updateMe', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(MockUser.findByIdAndUpdate as jest.Mock) = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'user1', name: 'Updated', weightKg: 82 }),
    })
  })

  it('records a changed profile weight as a weight-only measurement', async () => {
    ;(MockUser.findById as jest.Mock) = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ weightKg: 80 }),
    })
    mockCreateMeasurement.mockResolvedValue({} as Awaited<ReturnType<typeof createMeasurement>>)

    await updateMe('user1', { name: 'Updated', weightKg: 82 })

    expect(mockCreateMeasurement).toHaveBeenCalledWith('user1', { weightKg: 82 })
    expect(MockUser.findByIdAndUpdate).toHaveBeenCalledWith(
      'user1',
      { $set: { name: 'Updated' } },
      { new: true, runValidators: true }
    )
  })

  it('does not create another measurement when profile weight is unchanged', async () => {
    ;(MockUser.findById as jest.Mock) = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ weightKg: 80 }),
    })

    await updateMe('user1', { weightKg: 80 })

    expect(mockCreateMeasurement).not.toHaveBeenCalled()
  })
})
