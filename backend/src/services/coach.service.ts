import { Types } from 'mongoose'
import { CoachInvite, ICoachInvite } from '../models/CoachInvite.model'
import { CoachTraineeNote } from '../models/CoachTraineeNote.model'
import { User } from '../models/User.model'
import { IWorkoutSession, WorkoutSession } from '../models/WorkoutSession.model'
import { AchievementUnlock } from '../models/AchievementUnlock.model'
import { CoachWorkoutReview } from '../models/CoachWorkoutReview.model'
import { CoachProgressAlertClear } from '../models/CoachProgressAlert.model'
import { CoachSettings } from '../models/CoachSettings.model'
import { toExerciseKey } from '../utils/exerciseKey'

const userSelect = 'name email photo role coachId timezone'

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

  const activeTraineeCount = await User.countDocuments({ coachId: coach._id, role: 'trainee' })
  const coachProfile = await User.findById(coach._id).select('maxTrainees')
  if (activeTraineeCount >= (coachProfile?.maxTrainees ?? 20)) throw new Error('COACH_CAPACITY_REACHED')

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

const DEFAULT_COACH_SETTINGS = { inactivityDays: 7, stagnantWorkoutCount: 3 }

export async function getCoachSettings(coachUserId: string) {
  const coach = await requireUser(coachUserId)
  if (coach.role !== 'coach') throw new Error('COACH_ONLY')
  const settings = await CoachSettings.findOne({ coachId: coach._id }).lean()
  return settings
    ? { inactivityDays: settings.inactivityDays, stagnantWorkoutCount: settings.stagnantWorkoutCount }
    : DEFAULT_COACH_SETTINGS
}

export async function updateCoachSettings(
  coachUserId: string,
  updates: { inactivityDays?: unknown; stagnantWorkoutCount?: unknown }
) {
  const coach = await requireUser(coachUserId)
  if (coach.role !== 'coach') throw new Error('COACH_ONLY')
  const inactivityDays = Number(updates.inactivityDays)
  const stagnantWorkoutCount = Number(updates.stagnantWorkoutCount)
  if (!Number.isInteger(inactivityDays) || inactivityDays < 1 || inactivityDays > 90) {
    throw new Error('INVALID_INACTIVITY_DAYS')
  }
  if (!Number.isInteger(stagnantWorkoutCount) || stagnantWorkoutCount < 2 || stagnantWorkoutCount > 10) {
    throw new Error('INVALID_STAGNANT_WORKOUTS')
  }
  const settings = await CoachSettings.findOneAndUpdate(
    { coachId: coach._id },
    { $set: { inactivityDays, stagnantWorkoutCount } },
    { new: true, upsert: true, runValidators: true }
  ).lean()
  return { inactivityDays: settings.inactivityDays, stagnantWorkoutCount: settings.stagnantWorkoutCount }
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
  personalBests: Array<{ exerciseName: string; value: number; metric: 'weight' | 'reps' }>
}

export async function getDashboardSummary(
  coachUserId: string
): Promise<CoachDashboardSummary> {
  const coach = await requireUser(coachUserId)
  if (coach.role !== 'coach') throw new Error('COACH_ONLY')
  const { inactivityDays } = await getCoachSettings(coachUserId)

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
    AchievementUnlock.find({
      userId: { $in: traineeIds },
      category: 'personal_record',
      unlockedAt: { $gte: weekStart, $lte: now },
    }).select('userId exerciseName value achievementKey').lean(),
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
  const pbByTrainee = new Map<string, CoachDashboardTrainee['personalBests']>()
  pbTraineeIds.forEach(achievement => {
    const traineeId = String(achievement.userId)
    pbByTrainee.set(traineeId, [...(pbByTrainee.get(traineeId) ?? []), {
      exerciseName: achievement.exerciseName ?? 'Exercise',
      value: achievement.value,
      metric: achievement.achievementKey.includes('_reps_') ? 'reps' : 'weight',
    }])
  })
  const details = traineeProfiles.map(trainee => ({
    _id: String(trainee._id),
    name: trainee.name,
    email: trainee.email,
    workoutCountThisWeek: weeklyWorkoutCounts.get(String(trainee._id)) ?? 0,
    lastActiveAt: lastActivityByTrainee.get(String(trainee._id)) ?? null,
    personalBests: pbByTrainee.get(String(trainee._id)) ?? [],
  }))
  const pbIds = new Set(pbTraineeIds.map(achievement => String(achievement.userId)))

  return {
    totalWorkoutsThisWeek: weeklySessions.length,
    traineesNotStartedThisWeek: traineeIds.length - activeThisWeek.size,
    inactiveTrainees,
    traineesWithPbThisWeek: pbIds.size,
    inactivityDays,
    traineesWorkedOutThisWeek: details.filter(trainee => trainee.workoutCountThisWeek > 0),
    traineesNotStarted: details.filter(trainee => trainee.workoutCountThisWeek === 0),
    inactiveTraineeDetails: details.filter(trainee => (
      !trainee.lastActiveAt || trainee.lastActiveAt < inactiveSince
    )),
    traineesWithPb: details.filter(trainee => pbIds.has(trainee._id)),
  }
}

const localDateKey = (date: Date, timeZone: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(date)

export interface CoachWorkoutSetSummary {
  setNumber: number
  repsCompleted: number
  weightUsedKg?: number
  isPb: boolean
}

export interface CoachTodayWorkout {
  sessionId: string
  trainee: { _id: string; name: string; email: string; photo?: string }
  title: string
  completedAt: Date
  durationMinutes: number
  reviewedAt: Date | null
  exercises: Array<{ name: string; sets: CoachWorkoutSetSummary[] }>
}

const summarizeWorkout = async (
  session: IWorkoutSession,
  trainee: { _id: unknown; name: string; email: string; photo?: string },
  reviewedAt: Date | null
): Promise<CoachTodayWorkout> => {
  const previousSessions = await WorkoutSession.find({
    userId: session.userId,
    completedAt: { $ne: null, $lt: session.completedAt },
  }).select('exercises').lean()
  const previousBest = new Map<string, { weight: number; reps: number }>()
  previousSessions.forEach(previous => previous.exercises.forEach(exercise => {
    const key = exercise.exerciseKey || toExerciseKey(exercise.name)
    const best = previousBest.get(key) ?? { weight: 0, reps: 0 }
    exercise.sets.forEach(set => {
      best.weight = Math.max(best.weight, set.weightUsedKg ?? 0)
      best.reps = Math.max(best.reps, set.repsCompleted ?? 0)
    })
    previousBest.set(key, best)
  }))

  const exercises = session.exercises.map(exercise => {
    const key = exercise.exerciseKey || toExerciseKey(exercise.name)
    const previous = previousBest.get(key) ?? { weight: 0, reps: 0 }
    return {
      name: exercise.name,
      sets: exercise.sets.map(set => ({
        setNumber: set.setNumber,
        repsCompleted: set.repsCompleted,
        weightUsedKg: set.weightUsedKg,
        isPb: (set.weightUsedKg ?? 0) > previous.weight || set.repsCompleted > previous.reps,
      })),
    }
  })

  return {
    sessionId: String(session._id),
    trainee: { _id: String(trainee._id), name: trainee.name, email: trainee.email, photo: trainee.photo },
    title: session.title || session.exercises[0]?.name || 'Completed Workout',
    completedAt: session.completedAt as Date,
    durationMinutes: Math.max(0, Math.round(
      ((session.completedAt as Date).getTime() - session.startedAt.getTime()) / 60_000
    )),
    reviewedAt,
    exercises,
  }
}

export async function listTodayWorkouts(coachUserId: string): Promise<CoachTodayWorkout[]> {
  const coach = await requireUser(coachUserId)
  if (coach.role !== 'coach') throw new Error('COACH_ONLY')
  const trainees = await User.find({ coachId: coach._id, role: 'trainee' })
    .select('name email photo')
    .lean()
  if (!trainees.length) return []

  const now = new Date()
  const todayKey = localDateKey(now, coach.timezone ?? 'UTC')
  const recent = await WorkoutSession.find({
    userId: { $in: trainees.map(trainee => trainee._id) },
    completedAt: { $ne: null, $gte: new Date(now.getTime() - 36 * 60 * 60 * 1000) },
  }).sort({ completedAt: -1 })
  const sessions = recent.filter(session => (
    localDateKey(session.completedAt as Date, coach.timezone ?? 'UTC') === todayKey
  ))
  const reviews = await CoachWorkoutReview.find({
    coachId: coach._id,
    sessionId: { $in: sessions.map(session => session._id) },
  }).lean()
  const reviewBySession = new Map(reviews.map(review => [String(review.sessionId), review.reviewedAt]))
  const traineeById = new Map(trainees.map(trainee => [String(trainee._id), trainee]))

  const summaries = await Promise.all(sessions.map(session => summarizeWorkout(
    session,
    traineeById.get(String(session.userId))!,
    reviewBySession.get(String(session._id)) ?? null
  )))
  return summaries.sort((left, right) => {
    if (!!left.reviewedAt !== !!right.reviewedAt) return left.reviewedAt ? 1 : -1
    return right.completedAt.getTime() - left.completedAt.getTime()
  })
}

export async function reviewWorkout(coachUserId: string, sessionId: string) {
  if (!Types.ObjectId.isValid(sessionId)) throw new Error('INVALID_SESSION')
  const coach = await requireUser(coachUserId)
  if (coach.role !== 'coach') throw new Error('COACH_ONLY')
  const traineeIds = await User.find({ coachId: coach._id, role: 'trainee' }).distinct('_id')
  const session = await WorkoutSession.findOne({
    _id: sessionId,
    userId: { $in: traineeIds },
    completedAt: { $ne: null },
  })
  if (!session) throw new Error('WORKOUT_NOT_FOUND')

  const review = await CoachWorkoutReview.findOneAndUpdate(
    { coachId: coach._id, sessionId: session._id },
    { $setOnInsert: { traineeId: session.userId, reviewedAt: new Date() } },
    { new: true, upsert: true }
  ).lean()
  return { sessionId: String(session._id), reviewedAt: review.reviewedAt }
}

export interface StalledExerciseHistory {
  completedAt: Date
  maxWeightKg: number
  maxReps: number
}

export interface CoachProgressLookout {
  trainee: { _id: string; name: string; email: string; photo?: string }
  stalledWorkouts: Array<{
    workoutKey: string
    workoutName: string
    latestWorkoutAt: Date
    stagnantExerciseCount: number
    evaluatedExerciseCount: number
    exercises: Array<{
      exerciseKey: string
      exerciseName: string
      progressed: boolean
      history: StalledExerciseHistory[]
    }>
  }>
}

const normalizedWorkoutTitle = (title?: string) => (
  title?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'untitled'
)

export async function getProgressLookout(coachUserId: string): Promise<CoachProgressLookout[]> {
  const coach = await requireUser(coachUserId)
  if (coach.role !== 'coach') throw new Error('COACH_ONLY')
  const trainees = await User.find({ coachId: coach._id, role: 'trainee' })
    .select('name email photo')
    .sort({ name: 1 })
    .lean()
  if (!trainees.length) return []
  const { stagnantWorkoutCount } = await getCoachSettings(coachUserId)

  const clearedAlerts = await CoachProgressAlertClear.find({
    coachId: coach._id,
    traineeId: { $in: trainees.map(trainee => trainee._id) },
  }).lean()
  const clearedAtByAlert = new Map(clearedAlerts.map(alert => [
    `${alert.traineeId}:${alert.workoutKey}`,
    alert.clearedAt,
  ]))

  const sessions = await WorkoutSession.find({
    userId: { $in: trainees.map(trainee => trainee._id) },
    completedAt: { $ne: null },
  }).sort({ completedAt: -1 }).lean()
  const sessionsByTrainee = new Map<string, typeof sessions>()
  sessions.forEach(session => {
    const key = String(session.userId)
    sessionsByTrainee.set(key, [...(sessionsByTrainee.get(key) ?? []), session])
  })

  return trainees.flatMap(trainee => {
    const workoutGroups = new Map<string, typeof sessions>()
    for (const session of sessionsByTrainee.get(String(trainee._id)) ?? []) {
      const planSlot = session.dayIndex >= 0
        ? `${session.planId}:${session.dayIndex}`
        : `${session.planId}:custom:${normalizedWorkoutTitle(session.title)}`
      workoutGroups.set(planSlot, [...(workoutGroups.get(planSlot) ?? []), session])
    }

    const stalledWorkouts: CoachProgressLookout['stalledWorkouts'] = []
    workoutGroups.forEach((group, workoutKey) => {
      if (group.length < stagnantWorkoutCount) return
      const latestWorkouts = group.slice(0, stagnantWorkoutCount).reverse()
      const exerciseMaps = latestWorkouts.map(session => new Map(
        session.exercises
          .filter(exercise => exercise.sets.length > 0)
          .map(exercise => [exercise.exerciseKey || toExerciseKey(exercise.name), exercise])
      ))
      const comparableKeys = [...exerciseMaps[0].keys()].filter(key => (
        exerciseMaps.slice(1).every(map => map.has(key))
      ))
      if (!comparableKeys.length) return

      const exercises = comparableKeys.map(exerciseKey => {
        const history = exerciseMaps.map((map, index) => {
          const exercise = map.get(exerciseKey)!
          return {
            completedAt: latestWorkouts[index].completedAt as Date,
            maxWeightKg: Math.max(0, ...exercise.sets.map(set => set.weightUsedKg ?? 0)),
            maxReps: Math.max(0, ...exercise.sets.map(set => set.repsCompleted ?? 0)),
          }
        })
        const progressed = history.slice(1).some((entry, index) => (
          entry.maxWeightKg > history[index].maxWeightKg || entry.maxReps > history[index].maxReps
        ))
        return {
          exerciseKey,
          exerciseName: exerciseMaps[2].get(exerciseKey)!.name,
          progressed,
          history,
        }
      })
      const stagnantExerciseCount = exercises.filter(exercise => !exercise.progressed).length
      if (stagnantExerciseCount < Math.ceil(exercises.length / 2)) return

      const latest = latestWorkouts[latestWorkouts.length - 1]
      const clearedAt = clearedAtByAlert.get(`${trainee._id}:${workoutKey}`)
      if (clearedAt && (latest.completedAt as Date) <= clearedAt) return
      stalledWorkouts.push({
        workoutKey,
        workoutName: latest.title || `Workout ${latest.dayIndex + 1}`,
        latestWorkoutAt: latest.completedAt as Date,
        stagnantExerciseCount,
        evaluatedExerciseCount: exercises.length,
        exercises,
      })
    })

    return stalledWorkouts.length ? [{
      trainee: {
        _id: String(trainee._id),
        name: trainee.name,
        email: trainee.email,
        photo: trainee.photo,
      },
      stalledWorkouts: stalledWorkouts.sort((left, right) => (
        right.latestWorkoutAt.getTime() - left.latestWorkoutAt.getTime()
      )),
    }] : []
  })
}

export async function clearProgressLookout(
  coachUserId: string,
  traineeId: string,
  workoutKey: unknown
) {
  if (typeof workoutKey !== 'string' || !workoutKey.trim() || workoutKey.length > 300) {
    throw new Error('INVALID_WORKOUT_KEY')
  }
  const coach = await requireCoachTrainee(coachUserId, traineeId)
  const clearedAt = new Date()
  await CoachProgressAlertClear.findOneAndUpdate(
    { coachId: coach._id, traineeId, workoutKey },
    { $set: { clearedAt } },
    { upsert: true, new: true, runValidators: true }
  )
  return { traineeId, workoutKey, clearedAt }
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

  const coach = await User.findById(invite.coachId).select('maxTrainees role')
  if (!coach || coach.role !== 'coach') throw new Error('USER_NOT_FOUND')
  const activeTraineeCount = await User.countDocuments({ coachId: coach._id, role: 'trainee' })
  if (activeTraineeCount >= (coach.maxTrainees ?? 20)) throw new Error('COACH_CAPACITY_REACHED')

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
