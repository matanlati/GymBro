jest.mock('../src/models/CoachInvite.model')
jest.mock('../src/models/CoachTraineeNote.model')
jest.mock('../src/models/User.model')

import { Types } from 'mongoose'
import { CoachInvite } from '../src/models/CoachInvite.model'
import { User } from '../src/models/User.model'
import { leaveCoach, requireAssignedTrainee } from '../src/services/coach.service'

const MockUser = User as jest.Mocked<typeof User>
const MockCoachInvite = CoachInvite as jest.Mocked<typeof CoachInvite>
const COACH_ID = '507f1f77bcf86cd799439011'
const TRAINEE_ID = '507f1f77bcf86cd799439012'

const mockRequester = (
  user: { _id: string; role: 'coach' | 'trainee'; coachId?: string } | null
) => {
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

describe('coach.service leaveCoach', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequester({ _id: TRAINEE_ID, role: 'trainee', coachId: COACH_ID })
    ;(MockUser.updateOne as jest.Mock) = jest.fn().mockResolvedValue({ acknowledged: true })
    ;(MockCoachInvite.updateMany as jest.Mock) = jest.fn().mockResolvedValue({ acknowledged: true })
  })

  it('detaches the trainee from their coach and declines that coach\'s pending invites', async () => {
    const result = await leaveCoach(TRAINEE_ID)

    expect(MockUser.updateOne).toHaveBeenCalledWith({ _id: TRAINEE_ID }, { $unset: { coachId: 1 } })
    expect(MockCoachInvite.updateMany).toHaveBeenCalledWith(
      { traineeId: TRAINEE_ID, coachId: COACH_ID, status: 'pending' },
      { $set: { status: 'declined' } }
    )
    expect(result.coachId).toBe(COACH_ID)
    expect(result.leftAt).toBeInstanceOf(Date)
  })

  it('rejects a requester who is not a trainee', async () => {
    mockRequester({ _id: COACH_ID, role: 'coach', coachId: undefined })

    await expect(leaveCoach(COACH_ID)).rejects.toThrow('TRAINEE_ONLY')
    expect(MockUser.updateOne).not.toHaveBeenCalled()
  })

  it('rejects a trainee who has no coach', async () => {
    mockRequester({ _id: TRAINEE_ID, role: 'trainee', coachId: undefined })

    await expect(leaveCoach(TRAINEE_ID)).rejects.toThrow('TRAINEE_HAS_NO_COACH')
    expect(MockUser.updateOne).not.toHaveBeenCalled()
    expect(MockCoachInvite.updateMany).not.toHaveBeenCalled()
  })
})
