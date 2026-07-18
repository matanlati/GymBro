/**
 * Demo seed for the Progress feature.
 *
 * Creates (or resets) a single demo user with an active workout plan and a
 * batch of BACK-DATED, completed workout sessions. The sessions carry
 * progressively heavier sets so the Progress page shows a real strength curve,
 * a multi-day streak, personal records, and workout history.
 *
 * Run from backend/:
 *   npx ts-node src/db/seedProgressDemo.ts                     # default demo user
 *   npx ts-node src/db/seedProgressDemo.ts you@example.com     # seed an existing user
 *   npx ts-node src/db/seedProgressDemo.ts you@example.com --reset  # also wipe their plans/sessions
 *
 * Requires MONGODB_URI (and reads .env like the server does). No API keys.
 *
 * Behaviour:
 *  - If the user does not exist, a loginable demo account is created
 *    (demo@gymbro.dev / Demo1234).
 *  - If the user DOES exist, their account and existing data are preserved:
 *    other plans are only deactivated (never deleted) unless you pass --reset.
 *    A fresh "Strength Builder" plan + back-dated sessions are added.
 */
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import bcrypt from 'bcryptjs'
import { connectDB } from './connection'
import mongoose from 'mongoose'
import { User } from '../models/User.model'
import { WorkoutPlan } from '../models/WorkoutPlan.model'
import { WorkoutSession } from '../models/WorkoutSession.model'
import { ProgressGoal } from '../models/ProgressGoal.model'
import { BodyMeasurement } from '../models/BodyMeasurement.model'
import { AchievementUnlock } from '../models/AchievementUnlock.model'
import { toExerciseKey } from '../utils/exerciseKey'

const DEMO_EMAIL = 'demo@gymbro.dev'
const DEMO_PASSWORD = 'Demo1234'
const DEMO_NAME = 'Demo Trainee'
const SEED_PLAN_TITLE = 'Strength Builder'

// ── Plan definition ──────────────────────────────────────────────────────────
// Three training days. Weighted exercises trend upward; pull-ups progress by reps.
interface SeedExercise {
  name: string
  sets: number
  reps: number
  startWeight?: number
  increment?: number
  bodyweight?: boolean
}

type WeightedSeedExercise = SeedExercise & { startWeight: number; increment: number }

interface SeedDay {
  day: string
  focus: string
  exercises: SeedExercise[]
}

const PLAN_DAYS: SeedDay[] = [
  {
    day: 'Monday',
    focus: 'Upper Body Strength',
    exercises: [
      { name: 'Bench Press', sets: 4, reps: 8, startWeight: 60, increment: 2.5 },
      { name: 'Shoulder Press', sets: 3, reps: 10, startWeight: 30, increment: 1.5 },
      { name: 'Barbell Row', sets: 4, reps: 8, startWeight: 50, increment: 2 },
      { name: 'Pull-ups', sets: 3, reps: 8, bodyweight: true },
    ],
  },
  {
    day: 'Thursday',
    focus: 'Lower Body Strength',
    exercises: [
      { name: 'Squat', sets: 5, reps: 5, startWeight: 80, increment: 2.5 },
      { name: 'Deadlift', sets: 3, reps: 5, startWeight: 100, increment: 5 },
      { name: 'Leg Press', sets: 3, reps: 12, startWeight: 120, increment: 5 },
    ],
  },
  {
    day: 'Saturday',
    focus: 'Chest & Triceps',
    exercises: [
      { name: 'Barbell Bench Press', sets: 3, reps: 9, startWeight: 40, increment: 2.5 },
      { name: 'Incline Dumbbell Press', sets: 3, reps: 11, startWeight: 18, increment: 1 },
      { name: 'Tricep Pushdowns (machine)', sets: 3, reps: 12, startWeight: 25, increment: 1.5 },
      { name: 'Overhead Dumbbell Extension', sets: 3, reps: 13, startWeight: 12, increment: 1 },
    ],
  },
]

const SESSION_COUNT = 24 // ~8 weeks × 3 days

// ── Helpers ──────────────────────────────────────────────────────────────────
const startOfDay = (d: Date): Date => {
  const x = new Date(d)
  x.setHours(9, 0, 0, 0)
  return x
}

// Small ± noise so the reps/weights don't look robotic.
const jitter = (base: number, amount: number): number =>
  Math.round((base + (Math.random() * 2 - 1) * amount) * 10) / 10

// Round to the nearest 0.5 kg (plausible plate math).
const roundToPlate = (w: number): number => Math.round(w * 2) / 2

/**
 * Build a realistic top-set weight per training block for one exercise.
 * Overall trend is upward, but it includes plateaus (no change), the occasional
 * small deload/bad day (a dip), and random noise — so the chart looks human,
 * not like a straight ramp.
 *
 * `blocks` = number of times this exercise is trained across the seed.
 */
const buildWeightSeries = (ex: WeightedSeedExercise, blocks: number): number[] => {
  const series: number[] = []
  let weight = ex.startWeight

  // A gentle guaranteed baseline climb keeps every exercise trending up overall,
  // while the random events below add plateaus, dips, and bumps on top of it.
  const baselineStep = ex.increment * 0.6

  for (let b = 0; b < blocks; b++) {
    const roll = Math.random()
    if (b === 0) {
      // start where we start
    } else if (roll < 0.2) {
      // plateau — no progression this block (baseline still nudges it slightly)
      weight += baselineStep * 0.3
    } else if (roll < 0.32) {
      // deload / off day — dip below the recent trend
      weight -= ex.increment * (0.8 + Math.random())
    } else if (roll < 0.52) {
      // small bump
      weight += baselineStep + ex.increment * 0.3
    } else {
      // normal progression, sometimes a double jump
      weight += baselineStep + ex.increment * (roll > 0.85 ? 1.5 : 0.7)
    }

    // Per-session noise so even plateaus wiggle a little.
    const noisy = weight + (Math.random() * 2 - 1) * (ex.increment * 0.4)
    // Floor rises over time so a run of dips can't flatten the whole curve.
    const floor = ex.startWeight + baselineStep * b * 0.4
    series.push(roundToPlate(Math.max(floor, noisy)))
  }
  return series
}

async function run() {
  await connectDB()

  const args = process.argv.slice(2)
  const targetEmail = (args.find(a => !a.startsWith('--')) ?? DEMO_EMAIL).toLowerCase()
  const reset = args.includes('--reset')

  // 1. Resolve the user. Existing users are never overwritten or recreated;
  //    only a brand-new demo account gets created (and made loginable).
  let user = await User.findOne({ email: targetEmail })
  if (!user) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)
    user = await User.create({
      email: targetEmail,
      passwordHash,
      name: DEMO_NAME,
      age: 27,
      weightKg: 78,
      heightCm: 180,
      fitnessLevel: 'intermediate',
      goals: 'Build strength',
      timezone: 'Asia/Jerusalem',
    })
    console.log(`✓ Created new user: ${targetEmail} / ${DEMO_PASSWORD}  (id ${user._id})`)
  } else {
    console.log(`✓ Using existing user: ${targetEmail}  (id ${user._id})`)
  }

  // 2. Data cleanup policy.
  if (reset) {
    // Explicit opt-in: wipe this user's progress data.
    const [p, s] = await Promise.all([
      WorkoutPlan.deleteMany({ userId: user._id }),
      WorkoutSession.deleteMany({ userId: user._id }),
      ProgressGoal.deleteMany({ userId: user._id }),
      BodyMeasurement.deleteMany({ userId: user._id }),
      AchievementUnlock.deleteMany({ userId: user._id }),
    ])
    console.log(`  --reset: removed ${p.deletedCount} plans, ${s.deletedCount} sessions and supplemental progress data`)
  } else {
    // Preserve existing data. Only remove a previous run of THIS seed plan and
    // its sessions, and deactivate any other active plan (one active at a time).
    const priorSeeds = await WorkoutPlan.find({ userId: user._id, title: SEED_PLAN_TITLE }).select('_id')
    const priorIds = priorSeeds.map(p => p._id)
    if (priorIds.length) {
      await WorkoutSession.deleteMany({ userId: user._id, planId: { $in: priorIds } })
      await WorkoutPlan.deleteMany({ _id: { $in: priorIds } })
      console.log(`  refreshed previous "${SEED_PLAN_TITLE}" seed (${priorIds.length} plan(s))`)
    }
    await WorkoutPlan.updateMany({ userId: user._id, isActive: true }, { $set: { isActive: false } })
    console.log('  preserved existing plans/sessions; deactivated any active plan')
  }

  // 3. Active plan (matches the flat weeklyPlan shape the app uses).
  const plan = await WorkoutPlan.create({
    userId: user._id,
    title: SEED_PLAN_TITLE,
    programType: 'Strength',
    summary: 'A 3-day strength split with progressive overload.',
    weeklyPlan: PLAN_DAYS.map(d => ({
      day: d.day,
      focus: d.focus,
      exercises: d.exercises.map(e => ({
        exerciseKey: toExerciseKey(e.name),
        name: e.name,
        sets: String(e.sets),
        reps: String(e.reps),
      })),
    })),
    safetyNotes: ['Warm up before every session', 'Stop if you feel sharp pain'],
    progressionNotes: 'Add ~2.5kg once you hit all prescribed reps.',
    isActive: true,
  })
  console.log(`✓ Active plan: ${plan.title}`)

  // 4. Back-dated completed sessions, most recent last.
  // Alternate the two training days; step back ~3–4 days between sessions,
  // and keep the final stretch on consecutive days so the streak reads well.
  const today = startOfDay(new Date())
  const sessions = []

  // Pre-generate an organic weight series per exercise. Each exercise is trained
  // once per plan cycle, so it has SESSION_COUNT / PLAN_DAYS.length data points.
  const blocksPerExercise = Math.ceil(SESSION_COUNT / PLAN_DAYS.length)
  const weightSeriesByExercise = new Map<string, number[]>()
  for (const day of PLAN_DAYS) {
    for (const ex of day.exercises) {
      if (ex.startWeight !== undefined && ex.increment !== undefined) {
        weightSeriesByExercise.set(
          ex.name,
          buildWeightSeries(ex as WeightedSeedExercise, blocksPerExercise)
        )
      }
    }
  }

  for (let i = 0; i < SESSION_COUNT; i++) {
    const dayDef = PLAN_DAYS[i % PLAN_DAYS.length]
    const dayIndex = i % PLAN_DAYS.length
    const blockIndex = Math.floor(i / PLAN_DAYS.length) // which training block for this day's exercises

    // Date: spread older sessions further apart, tighten the last few days
    // so the "current streak" metric shows something meaningful.
    const daysAgo =
      i >= SESSION_COUNT - 4
        ? SESSION_COUNT - 1 - i // last 4 sessions on consecutive days (3,2,1,0)
        : (SESSION_COUNT - 1 - i) + 6 // older ones further back
    const scheduledDate = new Date(today)
    scheduledDate.setDate(scheduledDate.getDate() - daysAgo)
    const startedAt = new Date(scheduledDate)
    const completedAt = new Date(startedAt.getTime() + (42 + (i * 7) % 24) * 60_000)

    const exercises = dayDef.exercises.map((ex, orderIndex) => {
      const series = weightSeriesByExercise.get(ex.name)
      const topWeight = series?.[Math.min(blockIndex, series.length - 1)]
      const sets = Array.from({ length: ex.sets }, (_, s) => {
        const targetReps = ex.bodyweight
          ? ex.reps + Math.floor(blockIndex * 0.8)
          : ex.reps
        let weightUsedKg: number | undefined
        if (ex.startWeight !== undefined && topWeight !== undefined) {
          // Weighted sets ramp toward the top set; bodyweight sets intentionally omit weight.
          const rampFactor = ex.sets > 1 ? 0.9 + (0.1 * s) / (ex.sets - 1) : 1
          weightUsedKg = roundToPlate(Math.max(ex.startWeight, topWeight * rampFactor))
        }
        return {
          setNumber: s + 1,
          repsCompleted: Math.max(1, Math.round(jitter(targetReps, 1.5))),
          ...(weightUsedKg !== undefined ? { weightUsedKg } : {}),
          loggedAt: completedAt,
        }
      })
      return {
        exerciseKey: toExerciseKey(ex.name),
        name: ex.name,
        prescribedSets: String(ex.sets),
        prescribedReps: String(ex.reps),
        orderIndex,
        sets,
      }
    })

    sessions.push({
      userId: user._id,
      planId: plan._id,
      dayIndex,
      scheduledDate,
      startedAt,
      completedAt,
      exercises,
    })
  }

  await WorkoutSession.insertMany(sessions)

  // Body-composition history. Stable offsets make repeated runs idempotent.
  const measurements = [
    { daysAgo: 56, weightKg: 78.0, bodyFatPercent: 19.2, muscleMassKg: 32.0 },
    { daysAgo: 42, weightKg: 77.7, bodyFatPercent: 18.8, muscleMassKg: 32.6 },
    { daysAgo: 28, weightKg: 77.4, bodyFatPercent: 18.3, muscleMassKg: 33.2 },
    { daysAgo: 14, weightKg: 77.0, bodyFatPercent: 17.9, muscleMassKg: 33.9 },
    { daysAgo: 0, weightKg: 76.8, bodyFatPercent: 17.5, muscleMassKg: 34.5 },
  ]
  await Promise.all(measurements.map(measurement => {
    const measuredAt = new Date(today)
    measuredAt.setDate(measuredAt.getDate() - measurement.daysAgo)
    return BodyMeasurement.updateOne(
      { userId: user!._id, measuredAt },
      {
        $setOnInsert: {
          userId: user!._id,
          measuredAt,
          weightKg: measurement.weightKg,
          bodyFatPercent: measurement.bodyFatPercent,
          muscleMassKg: measurement.muscleMassKg,
        },
      },
      { upsert: true }
    )
  }))

  // Active goals used by the progress panel. Existing matching user goals win.
  const goalStart = new Date(today)
  goalStart.setDate(goalStart.getDate() - 56)
  await Promise.all([
    ProgressGoal.updateOne(
      { userId: user._id, type: 'weekly_workouts', status: 'active' },
      {
        $setOnInsert: {
          userId: user._id, type: 'weekly_workouts', baselineValue: 0,
          targetValue: 4, unit: 'workouts', startsAt: goalStart, status: 'active',
        },
      },
      { upsert: true }
    ),
    ProgressGoal.updateOne(
      { userId: user._id, type: 'exercise_strength', exerciseKey: 'bench_press', status: 'active' },
      {
        $setOnInsert: {
          userId: user._id, type: 'exercise_strength', exerciseKey: 'bench_press',
          exerciseName: 'Bench Press', baselineValue: 80, targetValue: 110,
          unit: 'kg', startsAt: goalStart, status: 'active',
        },
      },
      { upsert: true }
    ),
    ProgressGoal.updateOne(
      { userId: user._id, type: 'muscle_mass', status: 'active' },
      {
        $setOnInsert: {
          userId: user._id, type: 'muscle_mass', baselineValue: 32,
          targetValue: 36, unit: 'kg', startsAt: goalStart, status: 'active',
        },
      },
      { upsert: true }
    ),
  ])

  // Previously unlocked milestones. Keys match the production evaluator.
  await Promise.all([
    { achievementKey: 'workouts_1', category: 'workout_count', value: 1 },
    { achievementKey: 'workouts_10', category: 'workout_count', value: 10 },
    { achievementKey: 'streak_3', category: 'streak', value: 3 },
  ].map(achievement => AchievementUnlock.updateOne(
    { userId: user!._id, achievementKey: achievement.achievementKey },
    { $setOnInsert: { userId: user!._id, ...achievement, unlockedAt: today } },
    { upsert: true }
  )))
  console.log(`✓ Inserted ${sessions.length} completed sessions`)

  console.log('\nDone. Log in as the demo user and open /progress.')
  await mongoose.disconnect()
}

run().catch(async err => {
  console.error('Seed failed:', err)
  await mongoose.disconnect()
  process.exit(1)
})
