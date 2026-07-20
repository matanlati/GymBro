import { Types } from 'mongoose'
import { CoachInvite, ICoachInvite } from '../models/CoachInvite.model'
import { User } from '../models/User.model'

const userSelect = 'name email photo role coachId'

const requireUser = async (userId: string) => {
  const user = await User.findById(userId).select(userSelect)
  if (!user) throw new Error('USER_NOT_FOUND')
  return user
}

const populateInvite = (invite: ICoachInvite | null) => {
  if (!invite) throw new Error('INVITE_NOT_FOUND')
  return invite.populate([
    { path: 'coachId', select: 'name email photo role' },
    { path: 'traineeId', select: 'name email photo role coachId' },
  ])
}

export async function sendInvite(coachUserId: string, traineeEmail: string) {
  const coach = await requireUser(coachUserId)
  if (coach.role !== 'coach') throw new Error('COACH_ONLY')

  const normalizedEmail = traineeEmail?.trim().toLowerCase()
  if (!normalizedEmail) throw new Error('INVALID_EMAIL')

  const trainee = await User.findOne({ email: normalizedEmail }).select(userSelect)
  if (!trainee) throw new Error('TRAINEE_NOT_FOUND')
  if (trainee.role !== 'trainee') throw new Error('TARGET_NOT_TRAINEE')
  if (trainee.coachId) throw new Error('TRAINEE_ALREADY_HAS_COACH')

  const existing = await CoachInvite.findOne({
    coachId: coach._id,
    traineeId: trainee._id,
    status: 'pending',
  })
  if (existing) return populateInvite(existing)

  const invite = await CoachInvite.create({
    coachId: coach._id,
    traineeId: trainee._id,
    traineeEmail: normalizedEmail,
    status: 'pending',
  })

  return populateInvite(invite)
}

export async function listCoachInvites(coachUserId: string) {
  const coach = await requireUser(coachUserId)
  if (coach.role !== 'coach') throw new Error('COACH_ONLY')

  return CoachInvite.find({ coachId: coach._id })
    .sort({ createdAt: -1 })
    .populate('traineeId', 'name email photo role coachId')
    .populate('coachId', 'name email photo role')
    .lean()
}

export async function listCoachTrainees(coachUserId: string) {
  const coach = await requireUser(coachUserId)
  if (coach.role !== 'coach') throw new Error('COACH_ONLY')

  return User.find({ coachId: coach._id, role: 'trainee' })
    .select('name email photo age fitnessLevel goals createdAt')
    .sort({ name: 1 })
    .lean()
}

export async function removeTrainee(coachUserId: string, traineeId: string) {
  if (!Types.ObjectId.isValid(traineeId)) throw new Error('INVALID_TRAINEE')

  const coach = await requireUser(coachUserId)
  if (coach.role !== 'coach') throw new Error('COACH_ONLY')

  const trainee = await User.findOneAndUpdate(
    { _id: traineeId, coachId: coach._id, role: 'trainee' },
    { $unset: { coachId: 1 } },
    { new: true }
  ).select('name email photo age fitnessLevel goals createdAt')

  if (!trainee) throw new Error('COACH_TRAINEE_NOT_FOUND')
  return trainee
}

export async function listMyInvites(traineeUserId: string) {
  const trainee = await requireUser(traineeUserId)
  if (trainee.role !== 'trainee') throw new Error('TRAINEE_ONLY')

  return CoachInvite.find({ traineeId: trainee._id, status: 'pending' })
    .sort({ createdAt: -1 })
    .populate('coachId', 'name email photo role')
    .populate('traineeId', 'name email photo role coachId')
    .lean()
}

export async function acceptInvite(traineeUserId: string, inviteId: string) {
  if (!Types.ObjectId.isValid(inviteId)) throw new Error('INVALID_INVITE')

  const trainee = await requireUser(traineeUserId)
  if (trainee.role !== 'trainee') throw new Error('TRAINEE_ONLY')
  if (trainee.coachId) throw new Error('TRAINEE_ALREADY_HAS_COACH')

  const invite = await CoachInvite.findOne({
    _id: inviteId,
    traineeId: trainee._id,
    status: 'pending',
  })
  if (!invite) throw new Error('INVITE_NOT_FOUND')

  trainee.coachId = invite.coachId
  await trainee.save()

  invite.status = 'accepted'
  invite.acceptedAt = new Date()
  await invite.save()

  await CoachInvite.updateMany(
    { traineeId: trainee._id, status: 'pending', _id: { $ne: invite._id } },
    { $set: { status: 'declined' } }
  )

  return populateInvite(invite)
}
