import client from './client'
import { WorkoutPlan } from './plans.api'
import type {
  AchievementCategory,
  AchievementUnlock,
  BodyMeasurement,
  CreateProgressGoalPayload,
  ExercisePoint,
  ProgressGoal,
  ProgressGoalStatus,
  ProgressSummary,
  UpdateProgressGoalPayload,
} from './progress.api'

export interface CoachUser {
  _id: string
  name: string
  email: string
  photo?: string
  role: 'trainee' | 'coach'
  coachId?: string
  age?: number
  weightKg?: number
  heightCm?: number
  fitnessLevel?: string
  goals?: string
  createdAt?: string
}

export interface CoachInvite {
  _id: string
  coachId: CoachUser
  traineeId: CoachUser
  traineeEmail: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: string
  acceptedAt?: string
}

export function sendCoachInvite(email: string) {
  return client.post<CoachInvite>('/coach/invites', { email })
}

export function listCoachInvites() {
  return client.get<CoachInvite[]>('/coach/invites')
}

export function listCoachTrainees() {
  return client.get<CoachUser[]>('/coach/trainees')
}

export interface CoachManagedWorkoutSession {
  _id: string
  planId: string
  title?: string
  dayIndex: number
  scheduledDate: string
  startedAt: string
  completedAt: string
  notes?: string
  exercises: Array<{
    exerciseKey?: string
    name: string
    prescribedSets: string
    prescribedReps: string
    sets: Array<{ setNumber: number; repsCompleted: number; weightUsedKg?: number; loggedAt: string }>
  }>
}

export interface CoachTraineeWorkouts {
  plan: WorkoutPlan | null
  sessions: CoachManagedWorkoutSession[]
}

export interface CoachWorkoutTypeInput {
  name: string
  exercises: Array<{ name: string; sets: string; reps: string; notes?: string }>
}

export function getCoachTraineeWorkouts(traineeId: string) {
  return client.get<CoachTraineeWorkouts>(`/coach/trainees/${traineeId}/workouts`)
}

export function createCoachTraineeWorkoutType(traineeId: string, workout: CoachWorkoutTypeInput) {
  return client.post<WorkoutPlan>(`/coach/trainees/${traineeId}/workout-types`, workout)
}

export function updateCoachTraineeWorkoutType(traineeId: string, dayIndex: number, workout: CoachWorkoutTypeInput) {
  return client.put<WorkoutPlan>(`/coach/trainees/${traineeId}/workout-types/${dayIndex}`, workout)
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
  lastActiveAt: string | null
  personalBests: Array<{ exerciseName: string; value: number; metric: 'weight' | 'reps' }>
}

export function getCoachDashboardSummary() {
  return client.get<CoachDashboardSummary>('/coach/dashboard-summary')
}

export interface CoachAlertSettings {
  inactivityDays: number
  stagnantWorkoutCount: number
}

export function getCoachAlertSettings() {
  return client.get<CoachAlertSettings>('/coach/settings')
}

export function updateCoachAlertSettings(settings: CoachAlertSettings) {
  return client.put<CoachAlertSettings>('/coach/settings', settings)
}

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
  completedAt: string
  durationMinutes: number
  reviewedAt: string | null
  exercises: Array<{ name: string; sets: CoachWorkoutSetSummary[] }>
}

export function listCoachTodayWorkouts() {
  return client.get<CoachTodayWorkout[]>('/coach/today-workouts')
}

export function reviewCoachWorkout(sessionId: string) {
  return client.post<{ sessionId: string; reviewedAt: string }>(`/coach/workout-reviews/${sessionId}`)
}

export interface CoachProgressLookout {
  trainee: { _id: string; name: string; email: string; photo?: string }
  stalledWorkouts: Array<{
    workoutKey: string
    workoutName: string
    latestWorkoutAt: string
    stagnantExerciseCount: number
    evaluatedExerciseCount: number
    exercises: Array<{
      exerciseKey: string
      exerciseName: string
      progressed: boolean
      history: Array<{ completedAt: string; maxWeightKg: number; maxReps: number }>
    }>
  }>
}

export function getCoachProgressLookout() {
  return client.get<CoachProgressLookout[]>('/coach/progress-lookout')
}

export function clearCoachProgressLookout(traineeId: string, workoutKey: string) {
  return client.post<{ traineeId: string; workoutKey: string; clearedAt: string }>(
    `/coach/progress-lookout/${traineeId}/clear`,
    { workoutKey }
  )
}

export function removeCoachTrainee(traineeId: string) {
  return client.delete(`/coach/trainees/${traineeId}`)
}

export interface CoachTraineeNotes {
  notes: string
  updatedAt: string | null
}

export function getCoachTraineeNotes(traineeId: string) {
  return client.get<CoachTraineeNotes>(`/coach/trainees/${traineeId}/notes`)
}

export function saveCoachTraineeNotes(traineeId: string, notes: string) {
  return client.put<CoachTraineeNotes>(`/coach/trainees/${traineeId}/notes`, { notes })
}

export function listMyCoachInvites() {
  return client.get<CoachInvite[]>('/coach/my-invites')
}

export function acceptCoachInvite(inviteId: string) {
  return client.post<CoachInvite>(`/coach/invites/${inviteId}/accept`)
}

export type CoachProgressPeriod = 'week' | 'month' | 'quarter' | 'year'

export interface CoachProgressOverview {
  period: CoachProgressPeriod
  range: { from: string; to: string }
  completedWorkouts: {
    current: number
    previous: number
    changePercent: number | null
  }
  personalRecords: number
  goalsAchieved: number
}

export const getCoachProgressOverview = (period: CoachProgressPeriod = 'month') =>
  client.get<CoachProgressOverview>('/coach/progress/overview', { params: { period } })

export const getCoachTraineeProgressSummary = (traineeId: string) =>
  client.get<ProgressSummary>(`/coach/trainees/${traineeId}/progress/summary`)

export const getCoachTraineeExerciseSeries = (traineeId: string, exerciseName: string) =>
  client.get<ExercisePoint[]>(
    `/coach/trainees/${traineeId}/progress/exercise/${encodeURIComponent(exerciseName)}`
  )

export const listCoachTraineeGoals = (
  traineeId: string,
  status?: ProgressGoalStatus
) => client.get<ProgressGoal[]>(`/coach/trainees/${traineeId}/progress/goals`, {
  params: status ? { status } : undefined,
})

export const createCoachTraineeGoal = (
  traineeId: string,
  payload: CreateProgressGoalPayload
) => client.post<ProgressGoal>(`/coach/trainees/${traineeId}/progress/goals`, payload)

export const updateCoachTraineeGoal = (
  traineeId: string,
  goalId: string,
  payload: UpdateProgressGoalPayload
) => client.patch<ProgressGoal>(
  `/coach/trainees/${traineeId}/progress/goals/${goalId}`,
  payload
)

export const deleteCoachTraineeGoal = (traineeId: string, goalId: string) =>
  client.delete(`/coach/trainees/${traineeId}/progress/goals/${goalId}`)

export const listCoachTraineeAchievements = (
  traineeId: string,
  category?: AchievementCategory,
  limit = 20
) => client.get<AchievementUnlock[]>(
  `/coach/trainees/${traineeId}/progress/achievements`,
  { params: { ...(category ? { category } : {}), limit } }
)

export const listCoachTraineeMeasurements = (
  traineeId: string,
  params?: { from?: string; to?: string; limit?: number }
) => client.get<BodyMeasurement[]>(
  `/coach/trainees/${traineeId}/progress/measurements`,
  { params }
)
