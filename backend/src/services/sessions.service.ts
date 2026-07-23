import { Types } from 'mongoose'
import { WorkoutPlan } from '../models/WorkoutPlan.model'
import { WorkoutSession, IWorkoutSession } from '../models/WorkoutSession.model'
import { toExerciseKey } from '../utils/exerciseKey'
import { evaluateAchievements } from './achievements.service'
import { IAchievementUnlock } from '../models/AchievementUnlock.model'

export interface SetPayload {
  repsCompleted: number
  weightUsedKg?: number
}

export interface SchedulePayload {
  scheduledDate: string
  dayIndex?: number
  title?: string
}

export interface PersonalBestAchievement {
  exerciseKey: string
  exerciseName: string
  weightUsedKg?: number
  repsCompleted?: number
}

export interface CompleteSessionResult {
  session: IWorkoutSession
  achievements: PersonalBestAchievement[]
  unlockedAchievements: IAchievementUnlock[]
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

const durationFromExercise = (exercise: {
  name?: string
  durationMinutes?: string
  reps?: string
  notes?: string
}) => {
  if (exercise.durationMinutes?.trim()) return exercise.durationMinutes.trim()
  if (!/^(?:n\/?a|not applicable|-)?$/i.test(exercise.reps?.trim() ?? '')) return undefined
  const description = `${exercise.name ?? ''} ${exercise.notes ?? ''}`
  const match = description.match(/(\d+(?:\s*-\s*\d+)?)\s*[- ]?\s*(?:minutes?|mins?)\b/i)
  return match?.[1]?.replace(/\s+/g, '')
}

// Lowest dayIndex in the active plan that hasn't been completed this calendar week.
const firstIncompleteDay = async (
  userId: string,
  planId: Types.ObjectId,
  dayIndexes: number[]
): Promise<number> => {
  const weekStart = startOfWeek(new Date())
  const completed = await WorkoutSession.find({
    userId,
    planId,
    completedAt: { $ne: null },
    scheduledDate: { $gte: weekStart },
  }).select('dayIndex')

  const done = new Set(completed.map(s => s.dayIndex))
  for (const index of dayIndexes) {
    if (!done.has(index)) return index
  }
  return dayIndexes[0]
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

// Backfill plan metadata for sessions created before it was snapshotted.
// Once copied, the session keeps its own values even if the plan later changes.
const hydrateMissingCoachNotes = async (session: IWorkoutSession): Promise<IWorkoutSession> => {
  if (session.dayIndex < 0) return session
  const exercises = session.exercises ?? []
  if (!exercises.length) return session
  const needsHydration = exercises.some(exercise => (
    !exercise.coachNotes?.trim() || !exercise.prescribedDurationMinutes?.trim()
  ))
  if (!needsHydration) return session

  const plan = await WorkoutPlan.findById(session.planId).select('weeklyPlan')
  const planDay = plan?.weeklyPlan[session.dayIndex]
  if (!planDay) return session

  let changed = false
  exercises.forEach((exercise, index) => {
    if (exercise.coachNotes?.trim()) return
    const planExercise = planDay.exercises.find(candidate => (
      (candidate.exerciseKey || toExerciseKey(candidate.name)) === (exercise.exerciseKey || toExerciseKey(exercise.name))
    )) ?? planDay.exercises[index]
    if (!exercise.coachNotes?.trim() && planExercise?.notes) {
      exercise.coachNotes = planExercise.notes
      changed = true
    }
    if (!exercise.prescribedDurationMinutes?.trim() && planExercise) {
      const durationMinutes = durationFromExercise(planExercise)
      if (durationMinutes) {
        exercise.prescribedDurationMinutes = durationMinutes
        changed = true
      }
    }
  })
  if (changed) await session.save()
  return session
}

// Find-or-create today's session for the active plan. Default dayIndex is the
// first incomplete day this week. Upsert semantics avoid duplicate sessions on reload.
export const getOrCreateTodaySession = async (
  userId: string,
  dayIndex?: number
): Promise<IWorkoutSession> => {
  const plan = await WorkoutPlan.findOne({ userId, isActive: true })
  if (!plan) throw new Error('NO_ACTIVE_PLAN')

  const activeDayIndexes = plan.weeklyPlan.flatMap((day, index) => day.isArchived ? [] : [index])
  if (activeDayIndexes.length === 0) throw new Error('NO_ACTIVE_PLAN')

  let index = dayIndex
  if (index === undefined || index === null) {
    index = await firstIncompleteDay(userId, plan._id as Types.ObjectId, activeDayIndexes)
  }
  if (!Number.isInteger(index) || !activeDayIndexes.includes(index)) {
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
  if (existing) return hydrateMissingCoachNotes(existing)

  const planDay = plan.weeklyPlan[index]
  const exercises = (planDay?.exercises ?? []).map((ex, i) => ({
    exerciseKey: ex.exerciseKey || toExerciseKey(ex.name),
    name: ex.name,
    prescribedSets: ex.sets,
    prescribedReps: ex.reps,
    prescribedDurationMinutes: durationFromExercise(ex),
    coachNotes: ex.notes,
    orderIndex: i,
    sets: [],
  }))

  return WorkoutSession.create({
    userId,
    planId: plan._id,
    dayIndex: index,
    scheduledDate: dayStart,
    startedAt: new Date(),
    actualStartRecorded: true,
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

  const activeDayIndexes = plan.weeklyPlan.flatMap((day, dayIndex) => day.isArchived ? [] : [dayIndex])
  if (!activeDayIndexes.length) throw new Error('NO_ACTIVE_PLAN')
  let index = dayIndex
  if (index === undefined || index === null) {
    index = await firstIncompleteDay(userId, plan._id as Types.ObjectId, activeDayIndexes)
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

export const scheduleSession = async (
  userId: string,
  payload: SchedulePayload
): Promise<IWorkoutSession> => {
  const plan = await WorkoutPlan.findOne({ userId, isActive: true })
  if (!plan) throw new Error('NO_ACTIVE_PLAN')

  const scheduledDate = startOfDay(new Date(payload.scheduledDate))
  if (Number.isNaN(scheduledDate.getTime())) throw new Error('INVALID_SCHEDULED_DATE')

  const today = startOfDay(new Date())
  if (scheduledDate <= today) throw new Error('SCHEDULED_DATE_NOT_FUTURE')

  const hasPlanDay = payload.dayIndex !== undefined && payload.dayIndex !== null
  let dayIndex = -1
  let title = payload.title?.trim()
  let exercises: IWorkoutSession['exercises'] = []

  if (hasPlanDay) {
    const index = Number(payload.dayIndex)
    if (!Number.isInteger(index) || index < 0 || index >= plan.weeklyPlan.length || plan.weeklyPlan[index]?.isArchived) {
      throw new Error('INVALID_DAY_INDEX')
    }

    dayIndex = index
    const planDay = plan.weeklyPlan[index]
    title = planDay.focus
    exercises = (planDay.exercises ?? []).map((ex, i) => ({
      exerciseKey: ex.exerciseKey || toExerciseKey(ex.name),
      name: ex.name,
      prescribedSets: ex.sets,
      prescribedReps: ex.reps,
      prescribedDurationMinutes: durationFromExercise(ex),
      coachNotes: ex.notes,
      orderIndex: i,
      sets: [],
    }))
  } else if (!title) {
    throw new Error('INVALID_SCHEDULE_TITLE')
  }

  return WorkoutSession.create({
    userId,
    planId: plan._id,
    title,
    dayIndex,
    scheduledDate,
    exercises,
  })
}

export const getSession = async (userId: string, id: string): Promise<IWorkoutSession> =>
  hydrateMissingCoachNotes(await loadOwned(userId, id))

export const startSession = async (userId: string, id: string): Promise<IWorkoutSession> => {
  const session = await loadOwned(userId, id)
  if (!session.completedAt && !session.actualStartRecorded) {
    session.startedAt = new Date()
    session.actualStartRecorded = true
    await session.save()
  }
  return hydrateMissingCoachNotes(session)
}

const detectPersonalBests = async (
  userId: string,
  session: IWorkoutSession
): Promise<PersonalBestAchievement[]> => {
  const exerciseNames = session.exercises.map(exercise => exercise.name)
  const exerciseKeys = session.exercises.map(exercise =>
    exercise.exerciseKey || toExerciseKey(exercise.name)
  )
  if (exerciseNames.length === 0) return []

  const previous = await WorkoutSession.find({
    _id: { $ne: session._id },
    userId,
    completedAt: { $ne: null },
    $or: [
      { 'exercises.exerciseKey': { $in: exerciseKeys } },
      { 'exercises.name': { $in: exerciseNames } },
    ],
  }).select('exercises')

  const previousBest = new Map<string, { weightUsedKg: number; repsCompleted: number }>()
  previous.forEach(prevSession => {
    prevSession.exercises.forEach(exercise => {
      const key = exercise.exerciseKey || toExerciseKey(exercise.name)
      const best = previousBest.get(key) ?? { weightUsedKg: 0, repsCompleted: 0 }
      exercise.sets.forEach(set => {
        best.weightUsedKg = Math.max(best.weightUsedKg, set.weightUsedKg ?? 0)
        best.repsCompleted = Math.max(best.repsCompleted, set.repsCompleted ?? 0)
      })
      previousBest.set(key, best)
    })
  })

  return session.exercises.flatMap(exercise => {
    const exerciseKey = exercise.exerciseKey || toExerciseKey(exercise.name)
    const previous = previousBest.get(exerciseKey) ?? { weightUsedKg: 0, repsCompleted: 0 }
    const best = exercise.sets.reduce(
      (acc, set) => ({
        weightUsedKg: Math.max(acc.weightUsedKg, set.weightUsedKg ?? 0),
        repsCompleted: Math.max(acc.repsCompleted, set.repsCompleted ?? 0),
      }),
      { weightUsedKg: 0, repsCompleted: 0 }
    )

    if (best.weightUsedKg <= previous.weightUsedKg && best.repsCompleted <= previous.repsCompleted) {
      return []
    }

    return [{
      exerciseKey,
      exerciseName: exercise.name,
      weightUsedKg: best.weightUsedKg > previous.weightUsedKg ? best.weightUsedKg : undefined,
      repsCompleted: best.repsCompleted > previous.repsCompleted ? best.repsCompleted : undefined,
    }]
  })
}

export const completeSession = async (
  userId: string,
  id: string
): Promise<CompleteSessionResult> => {
  const session = await loadOwned(userId, id)
  const achievements = await detectPersonalBests(userId, session)
  session.completedAt = new Date()
  const saved = await session.save()
  let unlockedAchievements: IAchievementUnlock[] = []
  try {
    unlockedAchievements = await evaluateAchievements(userId, achievements)
  } catch (err) {
    console.error('Failed to persist achievements:', err)
  }
  return { session: saved, achievements, unlockedAchievements }
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
