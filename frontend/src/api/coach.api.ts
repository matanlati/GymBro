import client from './client'
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
