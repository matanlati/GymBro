import client from './client'

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
}

export function getCoachDashboardSummary(inactiveDays = 7) {
  return client.get<CoachDashboardSummary>('/coach/dashboard-summary', { params: { inactiveDays } })
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
