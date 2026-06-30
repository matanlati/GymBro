import { Types } from 'mongoose'
import { WorkoutPlan } from '../models/WorkoutPlan.model'
import { WorkoutSession, IWorkoutSession } from '../models/WorkoutSession.model'

export interface SetPayload {
  repsCompleted: number
  weightUsedKg?: number
}

const startOfDay = (d: Date): Date => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const startOfWeek = (d: Date): Date => {
  const x = startOfDay(d)
  x.setDate(x.getDate() - x.getDay()) // back to Sunday
  return x
}

// Lowest dayIndex in the active plan that hasn't been completed this calendar week.
const firstIncompleteDay = async (
  userId: string,
  planId: Types.ObjectId,
  dayCount: number
): Promise<number> => {
  const weekStart = startOfWeek(new Date())
  const completed = await WorkoutSession.find({
    userId,
    planId,
    completedAt: { $ne: null },
    scheduledDate: { $gte: weekStart },
  }).select('dayIndex')

  const done = new Set(completed.map(s => s.dayIndex))
  for (let i = 0; i < dayCount; i++) {
    if (!done.has(i)) return i
  }
  return 0
}

const loadOwned = async (userId: string, id: string): Promise<IWorkoutSession> => {
  const session = await WorkoutSession.findById(id)
  if (!session) throw new Error('SESSION_NOT_FOUND')
  if (session.userId.toString() !== userId) throw new Error('FORBIDDEN')
  return session
}

const requireExercise = (session: IWorkoutSession, exerciseIndex: number) => {
  if (
    !Number.isInteger(exerciseIndex) ||
    exerciseIndex < 0 ||
    exerciseIndex >= session.exercises.length
  ) {
    throw new Error('INVALID_EXERCISE_INDEX')
  }
  return session.exercises[exerciseIndex]
}

const requireSet = (session: IWorkoutSession, exerciseIndex: number, setIndex: number) => {
  const exercise = requireExercise(session, exerciseIndex)
  if (!Number.isInteger(setIndex) || setIndex < 0 || setIndex >= exercise.sets.length) {
    throw new Error('INVALID_SET_INDEX')
  }
  return exercise
}

// Find-or-create today's session for the active plan. Default dayIndex is the
// first incomplete day this week. Upsert semantics avoid duplicate sessions on reload.
export const getOrCreateTodaySession = async (
  userId: string,
  dayIndex?: number
): Promise<IWorkoutSession> => {
  const plan = await WorkoutPlan.findOne({ userId, isActive: true })
  if (!plan) throw new Error('NO_ACTIVE_PLAN')

  const dayCount = plan.weeklyPlan.length
  if (dayCount === 0) throw new Error('NO_ACTIVE_PLAN')

  let index = dayIndex
  if (index === undefined || index === null) {
    index = await firstIncompleteDay(userId, plan._id as Types.ObjectId, dayCount)
  }
  if (!Number.isInteger(index) || index < 0 || index >= dayCount) {
    throw new Error('INVALID_DAY_INDEX')
  }

  const dayStart = startOfDay(new Date())
  const nextDay = new Date(dayStart)
  nextDay.setDate(nextDay.getDate() + 1)

  const existing = await WorkoutSession.findOne({
    userId,
    planId: plan._id,
    dayIndex: index,
    scheduledDate: { $gte: dayStart, $lt: nextDay },
  })
  if (existing) return existing

  const planDay = plan.weeklyPlan[index]
  const exercises = (planDay?.exercises ?? []).map((ex, i) => ({
    name: ex.name,
    prescribedSets: ex.sets,
    prescribedReps: ex.reps,
    orderIndex: i,
    sets: [],
  }))

  return WorkoutSession.create({
    userId,
    planId: plan._id,
    dayIndex: index,
    scheduledDate: dayStart,
    exercises,
  })
}

// Read-only counterpart to the upsert: today's session or 404.
export const getTodaySession = async (
  userId: string,
  dayIndex?: number
): Promise<IWorkoutSession> => {
  const plan = await WorkoutPlan.findOne({ userId, isActive: true })
  if (!plan) throw new Error('NO_ACTIVE_PLAN')

  const dayCount = plan.weeklyPlan.length
  let index = dayIndex
  if (index === undefined || index === null) {
    index = await firstIncompleteDay(userId, plan._id as Types.ObjectId, dayCount)
  }

  const dayStart = startOfDay(new Date())
  const nextDay = new Date(dayStart)
  nextDay.setDate(nextDay.getDate() + 1)

  const existing = await WorkoutSession.findOne({
    userId,
    planId: plan._id,
    dayIndex: index,
    scheduledDate: { $gte: dayStart, $lt: nextDay },
  })
  if (!existing) throw new Error('SESSION_NOT_FOUND')
  return existing
}

export const listSessions = async (
  userId: string,
  date?: string
): Promise<IWorkoutSession[]> => {
  const query: Record<string, unknown> = { userId }
  if (date) {
    const start = startOfDay(new Date(date))
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    query.scheduledDate = { $gte: start, $lt: end }
  }
  return WorkoutSession.find(query).sort({ scheduledDate: -1 })
}

export const getSession = (userId: string, id: string): Promise<IWorkoutSession> =>
  loadOwned(userId, id)

export const completeSession = async (
  userId: string,
  id: string
): Promise<IWorkoutSession> => {
  const session = await loadOwned(userId, id)
  session.completedAt = new Date()
  return session.save()
}

export const logSet = async (
  userId: string,
  sessionId: string,
  exerciseIndex: number,
  payload: SetPayload
): Promise<IWorkoutSession> => {
  const session = await loadOwned(userId, sessionId)
  const exercise = requireExercise(session, exerciseIndex)

  if (typeof payload?.repsCompleted !== 'number' || payload.repsCompleted < 0) {
    throw new Error('INVALID_SET_PAYLOAD')
  }

  exercise.sets.push({
    setNumber: exercise.sets.length + 1, // server-assigned to avoid client races
    repsCompleted: payload.repsCompleted,
    weightUsedKg: payload.weightUsedKg,
    loggedAt: new Date(),
  })
  return session.save()
}

export const updateSet = async (
  userId: string,
  sessionId: string,
  exerciseIndex: number,
  setIndex: number,
  payload: Partial<SetPayload>
): Promise<IWorkoutSession> => {
  const session = await loadOwned(userId, sessionId)
  const exercise = requireSet(session, exerciseIndex, setIndex)
  const set = exercise.sets[setIndex]

  if (payload?.repsCompleted !== undefined) {
    if (typeof payload.repsCompleted !== 'number' || payload.repsCompleted < 0) {
      throw new Error('INVALID_SET_PAYLOAD')
    }
    set.repsCompleted = payload.repsCompleted
  }
  if (payload?.weightUsedKg !== undefined) {
    set.weightUsedKg = payload.weightUsedKg
  }
  return session.save()
}

export const deleteSet = async (
  userId: string,
  sessionId: string,
  exerciseIndex: number,
  setIndex: number
): Promise<IWorkoutSession> => {
  const session = await loadOwned(userId, sessionId)
  const exercise = requireSet(session, exerciseIndex, setIndex)

  exercise.sets.splice(setIndex, 1)
  // Renumber remaining sets so setNumber stays contiguous (1-based).
  exercise.sets.forEach((s, i) => {
    s.setNumber = i + 1
  })
  return session.save()
}
