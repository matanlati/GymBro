/**
 * Seeds an idempotent trainee roster for visually testing the coach dashboard.
 * Existing non-demo users and sessions are preserved.
 *
 * Run from backend/: npm run seed:coach-dashboard
 */
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDB } from './connection'
import { User } from '../models/User.model'
import { WorkoutPlan } from '../models/WorkoutPlan.model'
import { WorkoutSession } from '../models/WorkoutSession.model'
import { AchievementUnlock } from '../models/AchievementUnlock.model'
import { getDashboardSummary } from '../services/coach.service'

const COACH_EMAIL = 'abbyca@gmail.com'
const DEMO_PASSWORD = 'Demo1234'
const DEMO_SESSION_NOTE = 'coach-dashboard-demo-session'
const DEMO_PLAN_TITLE = 'Coach Dashboard Demo Plan'

const trainees = [
  { name: 'Maya Cohen', slug: 'maya', weeklyWorkouts: 3, lastActivityDaysAgo: 0, pbThisWeek: false },
  { name: 'Daniel Levi', slug: 'daniel', weeklyWorkouts: 2, lastActivityDaysAgo: 1, pbThisWeek: false },
  { name: 'Sofia Romano', slug: 'sofia', weeklyWorkouts: 1, lastActivityDaysAgo: 1, pbThisWeek: true },
  { name: 'Noah Williams', slug: 'noah', weeklyWorkouts: 4, lastActivityDaysAgo: 0, pbThisWeek: true },
  { name: 'Emma Davis', slug: 'emma', weeklyWorkouts: 0, lastActivityDaysAgo: 3, pbThisWeek: false },
  { name: 'Liam Brown', slug: 'liam', weeklyWorkouts: 0, lastActivityDaysAgo: 10, pbThisWeek: false },
  { name: 'Ava Martin', slug: 'ava', weeklyWorkouts: 0, lastActivityDaysAgo: 24, pbThisWeek: false },
  { name: 'Ethan Wilson', slug: 'ethan', weeklyWorkouts: 0, lastActivityDaysAgo: null, pbThisWeek: false },
] as const

const sessionDate = (daysAgo: number, hour: number) => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, 0, 0, 0)
  return date
}

async function run() {
  await connectDB()
  const coach = await User.findOne({ email: COACH_EMAIL, role: 'coach' })
  if (!coach) throw new Error(`Coach ${COACH_EMAIL} was not found`)

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)
  const weekStart = new Date()
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const elapsedWeekDays = Math.max(1, Math.floor((Date.now() - weekStart.getTime()) / 86_400_000) + 1)

  for (let traineeIndex = 0; traineeIndex < trainees.length; traineeIndex++) {
    const definition = trainees[traineeIndex]
    const email = `coach-dashboard-${definition.slug}@gymbro.dev`
    const trainee = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          name: definition.name,
          role: 'trainee',
          coachId: coach._id,
          age: 22 + traineeIndex,
          weightKg: 58 + traineeIndex * 4,
          heightCm: 164 + traineeIndex * 3,
          fitnessLevel: traineeIndex < 3 ? 'beginner' : traineeIndex < 6 ? 'intermediate' : 'advanced',
          goals: traineeIndex % 2 === 0 ? 'Build strength' : 'Improve overall fitness',
          timezone: 'Asia/Jerusalem',
        },
        $setOnInsert: { passwordHash },
      },
      { new: true, upsert: true, runValidators: true }
    )

    const plan = await WorkoutPlan.findOneAndUpdate(
      { userId: trainee._id, title: DEMO_PLAN_TITLE },
      {
        $set: {
          summary: 'A demo plan used to populate the coach dashboard.',
          programType: 'Strength',
          weeklyPlan: [{
            day: 'Monday',
            focus: 'Full Body Strength',
            exercises: [{ exerciseKey: 'goblet_squat', name: 'Goblet Squat', sets: '3', reps: '10' }],
          }],
          safetyNotes: [],
          progressionNotes: 'Increase the load gradually.',
          isActive: true,
        },
        $setOnInsert: { userId: trainee._id, title: DEMO_PLAN_TITLE },
      },
      { new: true, upsert: true, runValidators: true }
    )

    await WorkoutSession.deleteMany({ userId: trainee._id, notes: DEMO_SESSION_NOTE })

    const sessions = []
    for (let workoutIndex = 0; workoutIndex < definition.weeklyWorkouts; workoutIndex++) {
      const daysAgo = workoutIndex % elapsedWeekDays
      const startedAt = sessionDate(daysAgo, 7 + workoutIndex * 2)
      const completedAt = new Date(startedAt.getTime() + 48 * 60_000)
      sessions.push({
        userId: trainee._id,
        planId: plan._id,
        title: workoutIndex % 2 === 0 ? 'Full Body Strength' : 'Upper Body Session',
        dayIndex: 0,
        scheduledDate: startedAt,
        startedAt,
        completedAt,
        notes: DEMO_SESSION_NOTE,
        exercises: [{
          exerciseKey: 'goblet_squat',
          name: 'Goblet Squat',
          prescribedSets: '3',
          prescribedReps: '10',
          orderIndex: 0,
          sets: [{ setNumber: 1, repsCompleted: 10, weightUsedKg: 20 + traineeIndex, loggedAt: completedAt }],
        }],
      })
    }

    if (definition.weeklyWorkouts === 0 && definition.lastActivityDaysAgo !== null) {
      const startedAt = sessionDate(definition.lastActivityDaysAgo, 18)
      const completedAt = new Date(startedAt.getTime() + 42 * 60_000)
      sessions.push({
        userId: trainee._id,
        planId: plan._id,
        title: 'Previous Full Body Session',
        dayIndex: 0,
        scheduledDate: startedAt,
        startedAt,
        completedAt,
        notes: DEMO_SESSION_NOTE,
        exercises: [],
      })
    }

    if (sessions.length) await WorkoutSession.insertMany(sessions)

    const achievementKey = 'coach_dashboard_demo_pb'
    if (definition.pbThisWeek) {
      await AchievementUnlock.findOneAndUpdate(
        { userId: trainee._id, achievementKey },
        {
          $set: {
            category: 'personal_record',
            value: 20 + traineeIndex,
            exerciseKey: 'goblet_squat',
            exerciseName: 'Goblet Squat',
            unlockedAt: sessionDate(0, 12),
          },
          $setOnInsert: { userId: trainee._id, achievementKey },
        },
        { upsert: true, runValidators: true }
      )
    } else {
      await AchievementUnlock.deleteOne({ userId: trainee._id, achievementKey })
    }
  }

  const summary = await getDashboardSummary(String(coach._id))
  console.log(`Seeded ${trainees.length} dashboard trainees for ${coach.name} (${coach.email}).`)
  console.log(
    `Current cards: ${summary.totalWorkoutsThisWeek} workouts, ` +
    `${summary.traineesNotStartedThisWeek} not started, ` +
    `${summary.inactiveTrainees} inactive ${summary.inactivityDays}+ days, ` +
    `${summary.traineesWithPbThisWeek} with a PB.`
  )
  console.log(`Demo trainee password: ${DEMO_PASSWORD}`)
  await mongoose.disconnect()
}

run().catch(async error => {
  console.error('Coach dashboard seed failed:', error)
  await mongoose.disconnect()
  process.exit(1)
})
