/**
 * Repeatable coach-progress demo seed for the local GymBro database.
 *
 * Finds the coach by email (default: zelig@gmail.com), preserves all real users,
 * and refreshes only accounts ending in @zelig-progress.demo.
 *
 * Run from backend/:
 *   npm run seed:coach-progress
 *   npm run seed:coach-progress -- another-coach@example.com
 */
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import bcrypt from 'bcryptjs'
import mongoose, { Types } from 'mongoose'
import { connectDB } from './connection'
import { AchievementUnlock } from '../models/AchievementUnlock.model'
import { BodyMeasurement } from '../models/BodyMeasurement.model'
import { ProgressGoal } from '../models/ProgressGoal.model'
import { User } from '../models/User.model'
import { WorkoutPlan } from '../models/WorkoutPlan.model'
import { WorkoutSession } from '../models/WorkoutSession.model'
import { toExerciseKey } from '../utils/exerciseKey'

const DEFAULT_COACH_EMAIL = 'zelig@gmail.com'
const DEMO_DOMAIN = 'zelig-progress.demo'
const DEMO_PASSWORD = 'Demo1234'

type ActivityPattern =
  | 'always'
  | 'steady'
  | 'sporadic'
  | 'returned'
  | 'seasonal'
  | 'lapsed'
  | 'injury-return'
  | 'new-quiet'

interface TraineeProfile {
  slug: string
  name: string
  months: number
  sessionsPerWeek: number
  pattern: ActivityPattern
  age: number
  heightCm: number
  startWeight: number
  goal: string
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced'
}

const PROFILES: TraineeProfile[] = [
  { slug: 'maya-consistent', name: 'Maya Consistent', months: 36, sessionsPerWeek: 4, pattern: 'always', age: 31, heightCm: 168, startWeight: 67, goal: 'Build long-term strength', fitnessLevel: 'advanced' },
  { slug: 'daniel-steady', name: 'Daniel Steady', months: 24, sessionsPerWeek: 3, pattern: 'steady', age: 35, heightCm: 181, startWeight: 86, goal: 'Gain muscle and improve conditioning', fitnessLevel: 'intermediate' },
  { slug: 'noa-weekends', name: 'Noa Weekend Warrior', months: 18, sessionsPerWeek: 2, pattern: 'steady', age: 29, heightCm: 164, startWeight: 62, goal: 'Stay strong with a busy schedule', fitnessLevel: 'intermediate' },
  { slug: 'lior-sporadic', name: 'Lior Sporadic', months: 30, sessionsPerWeek: 3, pattern: 'sporadic', age: 40, heightCm: 176, startWeight: 91, goal: 'Improve consistency and lose fat', fitnessLevel: 'beginner' },
  { slug: 'tamar-returned', name: 'Tamar Quiet Then Returned', months: 26, sessionsPerWeek: 3, pattern: 'returned', age: 34, heightCm: 170, startWeight: 73, goal: 'Return to regular strength training', fitnessLevel: 'intermediate' },
  { slug: 'omer-seasonal', name: 'Omer Seasonal', months: 32, sessionsPerWeek: 4, pattern: 'seasonal', age: 27, heightCm: 184, startWeight: 82, goal: 'Build athletic strength', fitnessLevel: 'advanced' },
  { slug: 'yael-lapsed', name: 'Yael Currently Inactive', months: 20, sessionsPerWeek: 3, pattern: 'lapsed', age: 38, heightCm: 166, startWeight: 70, goal: 'Regain fitness after time away', fitnessLevel: 'intermediate' },
  { slug: 'avi-comeback', name: 'Avi Injury Comeback', months: 28, sessionsPerWeek: 3, pattern: 'injury-return', age: 43, heightCm: 179, startWeight: 88, goal: 'Rebuild safely after injury', fitnessLevel: 'intermediate' },
  { slug: 'ronit-active', name: 'Ronit High Performer', months: 14, sessionsPerWeek: 5, pattern: 'always', age: 26, heightCm: 172, startWeight: 65, goal: 'Increase all major lifts', fitnessLevel: 'advanced' },
  { slug: 'yossi-monthly', name: 'Yossi Occasional', months: 22, sessionsPerWeek: 2, pattern: 'sporadic', age: 46, heightCm: 174, startWeight: 94, goal: 'Move more and improve health', fitnessLevel: 'beginner' },
  { slug: 'shira-new', name: 'Shira New Starter', months: 4, sessionsPerWeek: 3, pattern: 'steady', age: 23, heightCm: 160, startWeight: 58, goal: 'Learn the basics and build confidence', fitnessLevel: 'beginner' },
  { slug: 'eden-quiet', name: 'Eden Quiet Account', months: 7, sessionsPerWeek: 2, pattern: 'new-quiet', age: 32, heightCm: 175, startWeight: 77, goal: 'Create a sustainable routine', fitnessLevel: 'beginner' },
]

const EXERCISE_DAYS = [
  [
    { name: 'Bench Press', start: 35, gain: 0.16, reps: 8 },
    { name: 'Barbell Row', start: 32, gain: 0.15, reps: 9 },
    { name: 'Shoulder Press', start: 20, gain: 0.1, reps: 10 },
  ],
  [
    { name: 'Squat', start: 50, gain: 0.22, reps: 7 },
    { name: 'Deadlift', start: 65, gain: 0.25, reps: 6 },
    { name: 'Lunge', start: 16, gain: 0.08, reps: 10 },
  ],
  [
    { name: 'Lat Pulldown', start: 30, gain: 0.13, reps: 10 },
    { name: 'Biceps Curl', start: 10, gain: 0.05, reps: 12 },
    { name: 'Triceps Extension', start: 12, gain: 0.05, reps: 12 },
  ],
] as const

const deterministic = (seed: number): number => {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

const startOfToday = (): Date => {
  const date = new Date()
  date.setHours(9, 0, 0, 0)
  return date
}

const isActiveWeek = (profile: TraineeProfile, weeksAgo: number): boolean => {
  switch (profile.pattern) {
    case 'always': return true
    case 'steady': return deterministic(weeksAgo + profile.age) > 0.08
    case 'sporadic': return deterministic(weeksAgo * 3 + profile.age) > 0.58
    case 'returned': return weeksAgo <= 11 || weeksAgo >= 34
    case 'seasonal': return Math.floor(weeksAgo / 9) % 2 === 0
    case 'lapsed': return weeksAgo >= 16
    case 'injury-return': return weeksAgo <= 9 || weeksAgo >= 30
    case 'new-quiet': return weeksAgo === 0 || weeksAgo === 3 || weeksAgo === 9
  }
}

const sessionCountForWeek = (profile: TraineeProfile, weeksAgo: number): number => {
  if (!isActiveWeek(profile, weeksAgo)) return 0
  const variation = deterministic(weeksAgo * 7 + profile.age)
  if (profile.pattern === 'sporadic' || profile.pattern === 'new-quiet') {
    return variation > 0.72 ? 2 : 1
  }
  return Math.max(1, profile.sessionsPerWeek - (variation < 0.16 ? 1 : 0))
}

const buildSessions = (
  profile: TraineeProfile,
  userId: Types.ObjectId,
  planId: Types.ObjectId,
  today: Date
) => {
  const totalWeeks = Math.round(profile.months * 4.345)
  const sessions = []

  for (let weeksAgo = totalWeeks - 1; weeksAgo >= 0; weeksAgo -= 1) {
    const count = sessionCountForWeek(profile, weeksAgo)
    for (let weeklyIndex = 0; weeklyIndex < count; weeklyIndex += 1) {
      const dayIndex = weeklyIndex % EXERCISE_DAYS.length
      const scheduledDate = new Date(today)
      scheduledDate.setDate(today.getDate() - weeksAgo * 7 - Math.max(0, 5 - weeklyIndex * 2))
      const startedAt = new Date(scheduledDate)
      const duration = 38 + Math.round(deterministic(weeksAgo + weeklyIndex + profile.age) * 34)
      const completedAt = new Date(startedAt.getTime() + duration * 60_000)
      const progressWeek = totalWeeks - weeksAgo

      const exercises = EXERCISE_DAYS[dayIndex].map((exercise, exerciseIndex) => {
        const abilityScale = profile.fitnessLevel === 'advanced'
          ? 1.35
          : profile.fitnessLevel === 'intermediate' ? 1.12 : 0.9
        const trend = exercise.start * abilityScale + progressWeek * exercise.gain
        const offDay = (deterministic(weeksAgo * 11 + exerciseIndex + profile.age) - 0.5) * 4
        const topWeight = Math.max(exercise.start, Math.round((trend + offDay) * 2) / 2)
        const sets = Array.from({ length: 3 }, (_, setIndex) => ({
          setNumber: setIndex + 1,
          repsCompleted: Math.max(4, exercise.reps + (setIndex === 2 ? -1 : 0)),
          weightUsedKg: Math.round(topWeight * (0.9 + setIndex * 0.05) * 2) / 2,
          loggedAt: completedAt,
        }))
        return {
          exerciseKey: toExerciseKey(exercise.name),
          name: exercise.name,
          prescribedSets: '3',
          prescribedReps: String(exercise.reps),
          orderIndex: exerciseIndex,
          sets,
        }
      })

      sessions.push({
        userId,
        planId,
        title: EXERCISE_DAYS[dayIndex][0].name + ' Day',
        dayIndex,
        scheduledDate,
        startedAt,
        completedAt,
        exercises,
      })
    }
  }
  return sessions
}

async function removePreviousDemoUsers() {
  const users = await User.find({ email: { $regex: `@${DEMO_DOMAIN}$` } }).select('_id')
  const userIds = users.map(user => user._id)
  if (userIds.length === 0) return

  await Promise.all([
    WorkoutSession.deleteMany({ userId: { $in: userIds } }),
    WorkoutPlan.deleteMany({ userId: { $in: userIds } }),
    ProgressGoal.deleteMany({ userId: { $in: userIds } }),
    BodyMeasurement.deleteMany({ userId: { $in: userIds } }),
    AchievementUnlock.deleteMany({ userId: { $in: userIds } }),
  ])
  await User.deleteMany({ _id: { $in: userIds } })
  console.log(`Refreshed ${userIds.length} previous coach-progress demo trainees`)
}

async function run() {
  await connectDB()
  const coachEmail = (process.argv[2] ?? DEFAULT_COACH_EMAIL).trim().toLowerCase()
  const coach = await User.findOne({ email: coachEmail, role: 'coach' })
  if (!coach) throw new Error(`Coach not found: ${coachEmail}`)

  await removePreviousDemoUsers()
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)
  const today = startOfToday()
  let totalSessions = 0

  for (const [profileIndex, profile] of PROFILES.entries()) {
    const email = `${profile.slug}@${DEMO_DOMAIN}`
    const user = await User.create({
      email,
      passwordHash,
      name: profile.name,
      role: 'trainee',
      coachId: coach._id,
      age: profile.age,
      weightKg: profile.startWeight,
      heightCm: profile.heightCm,
      fitnessLevel: profile.fitnessLevel,
      goals: profile.goal,
      timezone: 'Asia/Jerusalem',
    })

    const plan = await WorkoutPlan.create({
      userId: user._id,
      title: 'Coach Progress Demo Program',
      programType: 'Strength and conditioning',
      summary: `Long-running ${profile.pattern} training history for coach progress review.`,
      weeklyPlan: EXERCISE_DAYS.map((exercises, dayIndex) => ({
        day: ['Monday', 'Wednesday', 'Friday'][dayIndex],
        focus: ['Upper Body', 'Lower Body', 'Pull and Arms'][dayIndex],
        exercises: exercises.map(exercise => ({
          exerciseKey: toExerciseKey(exercise.name),
          name: exercise.name,
          sets: '3',
          reps: String(exercise.reps),
        })),
      })),
      safetyNotes: ['Warm up before training', 'Use controlled technique'],
      progressionNotes: 'Progress gradually when every prescribed rep is completed.',
      isActive: profile.pattern !== 'lapsed',
    })

    const sessions = buildSessions(profile, user._id, plan._id, today)
    if (sessions.length > 0) await WorkoutSession.insertMany(sessions)
    totalSessions += sessions.length

    const measurementCount = Math.max(3, Math.floor(profile.months / 2))
    const measurements = Array.from({ length: measurementCount }, (_, index) => {
      const measuredAt = new Date(today)
      measuredAt.setDate(today.getDate() - (measurementCount - 1 - index) * 56)
      const direction = profileIndex % 3 === 0 ? 1 : -1
      return {
        userId: user._id,
        measuredAt,
        weightKg: Math.round((profile.startWeight + direction * index * 0.22) * 10) / 10,
        bodyFatPercent: Math.round((22 - index * 0.18 + profileIndex * 0.2) * 10) / 10,
        muscleMassKg: Math.round((profile.startWeight * 0.4 + index * 0.15) * 10) / 10,
      }
    })
    await BodyMeasurement.insertMany(measurements)

    const goalStart = new Date(today)
    goalStart.setMonth(goalStart.getMonth() - 4)
    const completedGoalDate = new Date(today)
    completedGoalDate.setDate(today.getDate() - (profileIndex % 4) * 8)
    await ProgressGoal.insertMany([
      {
        userId: user._id,
        type: 'weekly_workouts',
        baselineValue: 0,
        targetValue: Math.min(5, profile.sessionsPerWeek),
        unit: 'workouts',
        startsAt: goalStart,
        status: 'active',
      },
      {
        userId: user._id,
        type: 'exercise_strength',
        exerciseKey: 'bench_press',
        exerciseName: 'Bench Press',
        baselineValue: 35,
        targetValue: 75 + profileIndex * 2,
        unit: 'kg',
        startsAt: goalStart,
        status: 'active',
      },
      ...(profileIndex % 2 === 0 ? [{
        userId: user._id,
        type: 'weekly_workouts' as const,
        baselineValue: 0,
        targetValue: 3,
        unit: 'workouts' as const,
        startsAt: goalStart,
        status: 'completed' as const,
        completedAt: completedGoalDate,
      }] : []),
    ])

    const unlockDates = [180, 90, 28, profileIndex % 3]
    await AchievementUnlock.insertMany(unlockDates.map((daysAgo, index) => {
      const unlockedAt = new Date(today)
      unlockedAt.setDate(today.getDate() - daysAgo)
      return {
        userId: user._id,
        achievementKey: `seed_pr_${profile.slug}_${index}`,
        category: 'personal_record',
        value: 45 + profileIndex * 3 + index * 5,
        exerciseKey: index % 2 === 0 ? 'bench_press' : 'squat',
        exerciseName: index % 2 === 0 ? 'Bench Press' : 'Squat',
        unlockedAt,
      }
    }))

    console.log(`  ${profile.name.padEnd(27)} ${String(sessions.length).padStart(4)} sessions  ${profile.pattern}`)
  }

  console.log(`\nSeeded ${PROFILES.length} trainees under ${coach.name} <${coach.email}>`)
  console.log(`Inserted ${totalSessions} completed sessions plus goals, records, and measurements`)
  console.log(`Demo login password for every seeded trainee: ${DEMO_PASSWORD}`)
  await mongoose.disconnect()
}

run().catch(async error => {
  console.error('Coach progress seed failed:', error)
  await mongoose.disconnect()
  process.exit(1)
})
