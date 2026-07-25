jest.mock('../src/models/CoachInvite.model')
jest.mock('../src/models/CoachTraineeNote.model')
jest.mock('../src/models/User.model')

import { Types } from 'mongoose'
import { User } from '../src/models/User.model'
import { requireAssignedTrainee } from '../src/services/coach.service'

const MockUser = User as jest.Mocked<typeof User>
const COACH_ID = '507f1f77bcf86cd799439011'
const TRAINEE_ID = '507f1f77bcf86cd799439012'

const mockRequester = (user: { _id: string; role: 'coach' | 'trainee' } | null) => {
  ;(MockUser.findById as jest.Mock) = jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue(user),
  })
}

describe('coach.service requireAssignedTrainee', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequester({ _id: COACH_ID, role: 'coach' })
    ;(MockUser.exists as jest.Mock) = jest.fn().mockResolvedValue({ _id: TRAINEE_ID })
  })

  it('authorizes a trainee currently assigned to the requesting coach', async () => {
    const coach = await requireAssignedTrainee(COACH_ID, TRAINEE_ID)

    expect(coach).toEqual({ _id: COACH_ID, role: 'coach' })
    expect(MockUser.exists).toHaveBeenCalledWith({
      _id: TRAINEE_ID,
      coachId: COACH_ID,
      role: 'trainee',
    })
  })

  it('rejects an invalid trainee id before querying either user', async () => {
    await expect(requireAssignedTrainee(COACH_ID, 'not-an-object-id'))
      .rejects.toThrow('INVALID_TRAINEE')

    expect(MockUser.findById).not.toHaveBeenCalled()
    expect(MockUser.exists).not.toHaveBeenCalled()
  })

  it('rejects access when the requester is not a coach', async () => {
    mockRequester({ _id: COACH_ID, role: 'trainee' })

    await expect(requireAssignedTrainee(COACH_ID, TRAINEE_ID))
      .rejects.toThrow('COACH_ONLY')

    expect(MockUser.exists).not.toHaveBeenCalled()
  })

  it('rejects a trainee who is not assigned to the requesting coach', async () => {
    ;(MockUser.exists as jest.Mock) = jest.fn().mockResolvedValue(null)

    await expect(requireAssignedTrainee(COACH_ID, TRAINEE_ID))
      .rejects.toThrow('COACH_TRAINEE_NOT_FOUND')

    expect(MockUser.exists).toHaveBeenCalledWith({
      _id: TRAINEE_ID,
      coachId: COACH_ID,
      role: 'trainee',
    })
  })

  it('queries ownership with ObjectId-compatible identifiers', () => {
    expect(Types.ObjectId.isValid(COACH_ID)).toBe(true)
    expect(Types.ObjectId.isValid(TRAINEE_ID)).toBe(true)
  })
})
