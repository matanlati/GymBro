import { Types } from 'mongoose'
import { CoachInvite, ICoachInvite } from '../models/CoachInvite.model'
import { CoachTraineeNote } from '../models/CoachTraineeNote.model'
import { User } from '../models/User.model'
import { WorkoutSession } from '../models/WorkoutSession.model'
import { AchievementUnlock } from '../models/AchievementUnlock.model'

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
    .select('name email photo age weightKg heightCm fitnessLevel goals createdAt')
    .sort({ name: 1 })
    .lean()
}

export interface CoachDashboardSummary {
  totalWorkoutsThisWeek: number
  traineesNotStartedThisWeek: number
  inactiveTrainees: number
  traineesWithPbThisWeek: number
  inactivityDays: number
  traineesWorkedOutThisWeek: CoachDashboardTrainee[]
  traineesNotStarted: CoachDashboardTrainee[]
  inactiveTraineeDetails: CoachDashboardTrainee[]
  traineesWithPb: CoachDashboardTrainee[]
}

export interface CoachDashboardTrainee {
  _id: string
  name: string
  email: string
  workoutCountThisWeek: number
  lastActiveAt: Date | null
}

export async function getDashboardSummary(
  coachUserId: string,
  inactivityDays = 7
): Promise<CoachDashboardSummary> {
  const coach = await requireUser(coachUserId)
  if (coach.role !== 'coach') throw new Error('COACH_ONLY')
  if (!Number.isInteger(inactivityDays) || inactivityDays < 1 || inactivityDays > 90) {
    throw new Error('INVALID_INACTIVITY_DAYS')
  }

  const traineeIds = await User.find({ coachId: coach._id, role: 'trainee' }).distinct('_id')
  if (traineeIds.length === 0) {
    return {
      totalWorkoutsThisWeek: 0,
      traineesNotStartedThisWeek: 0,
      inactiveTrainees: 0,
      traineesWithPbThisWeek: 0,
      inactivityDays,
      traineesWorkedOutThisWeek: [],
      traineesNotStarted: [],
      inactiveTraineeDetails: [],
      traineesWithPb: [],
    }
  }

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const inactiveSince = new Date(now.getTime() - inactivityDays * 24 * 60 * 60 * 1000)

  const [weeklySessions, lastActivity, pbTraineeIds] = await Promise.all([
    WorkoutSession.find({
      userId: { $in: traineeIds },
      completedAt: { $gte: weekStart, $lte: now },
    }).select('userId').lean(),
    WorkoutSession.aggregate<{ _id: Types.ObjectId; lastCompletedAt: Date }>([
      { $match: { userId: { $in: traineeIds }, completedAt: { $ne: null } } },
      { $group: { _id: '$userId', lastCompletedAt: { $max: '$completedAt' } } },
    ]),
    AchievementUnlock.distinct('userId', {
      userId: { $in: traineeIds },
      category: 'personal_record',
      unlockedAt: { $gte: weekStart, $lte: now },
    }),
  ])

  const activeThisWeek = new Set(weeklySessions.map(session => String(session.userId)))
  const weeklyWorkoutCounts = weeklySessions.reduce<Map<string, number>>((counts, session) => {
    const traineeId = String(session.userId)
    counts.set(traineeId, (counts.get(traineeId) ?? 0) + 1)
    return counts
  }, new Map())
  const lastActivityByTrainee = new Map(
    lastActivity.map(activity => [String(activity._id), activity.lastCompletedAt])
  )
  const inactiveTrainees = traineeIds.filter(traineeId => {
    const lastCompletedAt = lastActivityByTrainee.get(String(traineeId))
    return !lastCompletedAt || lastCompletedAt < inactiveSince
  }).length
  const traineeProfiles = await User.find({ _id: { $in: traineeIds } })
    .select('name email')
    .sort({ name: 1 })
    .lean()
  const details = traineeProfiles.map(trainee => ({
    _id: String(trainee._id),
    name: trainee.name,
    email: trainee.email,
    workoutCountThisWeek: weeklyWorkoutCounts.get(String(trainee._id)) ?? 0,
    lastActiveAt: lastActivityByTrainee.get(String(trainee._id)) ?? null,
  }))
  const pbIds = new Set(pbTraineeIds.map(id => String(id)))

  return {
    totalWorkoutsThisWeek: weeklySessions.length,
    traineesNotStartedThisWeek: traineeIds.length - activeThisWeek.size,
    inactiveTrainees,
    traineesWithPbThisWeek: pbTraineeIds.length,
    inactivityDays,
    traineesWorkedOutThisWeek: details.filter(trainee => trainee.workoutCountThisWeek > 0),
    traineesNotStarted: details.filter(trainee => trainee.workoutCountThisWeek === 0),
    inactiveTraineeDetails: details.filter(trainee => (
      !trainee.lastActiveAt || trainee.lastActiveAt < inactiveSince
    )),
    traineesWithPb: details.filter(trainee => pbIds.has(trainee._id)),
  }
}

const requireCoachTrainee = async (coachUserId: string, traineeId: string) => {
  if (!Types.ObjectId.isValid(traineeId)) throw new Error('INVALID_TRAINEE')
  const coach = await requireUser(coachUserId)
  if (coach.role !== 'coach') throw new Error('COACH_ONLY')

  const trainee = await User.exists({ _id: traineeId, coachId: coach._id, role: 'trainee' })
  if (!trainee) throw new Error('COACH_TRAINEE_NOT_FOUND')
  return coach
}

export async function getTraineeNotes(coachUserId: string, traineeId: string) {
  const coach = await requireCoachTrainee(coachUserId, traineeId)
  const record = await CoachTraineeNote.findOne({ coachId: coach._id, traineeId }).lean()
  return { notes: record?.notes ?? '', updatedAt: record?.updatedAt ?? null }
}

export async function saveTraineeNotes(coachUserId: string, traineeId: string, notes: unknown) {
  if (typeof notes !== 'string' || notes.length > 5000) throw new Error('INVALID_NOTES')
  const coach = await requireCoachTrainee(coachUserId, traineeId)
  const record = await CoachTraineeNote.findOneAndUpdate(
    { coachId: coach._id, traineeId },
    { $set: { notes } },
    { new: true, upsert: true, runValidators: true }
  ).lean()
  return { notes: record.notes, updatedAt: record.updatedAt }
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
