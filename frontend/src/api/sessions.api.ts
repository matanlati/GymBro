import client from './client'

export interface SetLog {
  setNumber: number
  repsCompleted: number
  weightUsedKg?: number
  loggedAt: string
}

export interface ExerciseLog {
  name: string
  muscleGroups?: string[]
  prescribedSets: string
  prescribedReps: string
  prescribedDurationMinutes?: string
  prescribedWeightKg?: number
  coachNotes?: string
  orderIndex: number
  sets: SetLog[]
}

export interface Session {
  _id: string
  userId: string
  planId: string
  title?: string
  dayIndex: number
  scheduledDate: string
  completedAt?: string
  startedAt?: string
  notes?: string
  exercises: ExerciseLog[]
  createdAt: string
}

export interface SetPayload {
  repsCompleted: number
  weightUsedKg?: number
}

export interface PersonalBestAchievement {
  exerciseName: string
  weightUsedKg?: number
  repsCompleted?: number
}

export interface CompleteSessionResult {
  session: Session
  achievements: PersonalBestAchievement[]
}

export interface ScheduleSessionPayload {
  scheduledDate: string
  dayIndex?: number
  title?: string
}

export const listSessions = (date?: string) =>
  client.get<Session[]>('/sessions', { params: date ? { date } : undefined })

export const getOrCreateToday = (dayIndex?: number) =>
  client.post<Session>('/sessions/today', dayIndex !== undefined ? { dayIndex } : {})

export const scheduleSession = (payload: ScheduleSessionPayload) =>
  client.post<Session>('/sessions/scheduled', payload)

export const getSession = (id: string) => client.get<Session>(`/sessions/${id}`)

export const startSession = (id: string) => client.post<Session>(`/sessions/${id}/start`)

export const completeSession = (id: string) =>
  client.post<CompleteSessionResult>(`/sessions/${id}/complete`)

export const logSet = (sessionId: string, exerciseIndex: number, payload: SetPayload) =>
  client.post<Session>(`/sessions/${sessionId}/exercises/${exerciseIndex}/sets`, payload)

export const updateSet = (
  sessionId: string,
  exerciseIndex: number,
  setIndex: number,
  payload: Partial<SetPayload>
) =>
  client.put<Session>(`/sessions/${sessionId}/exercises/${exerciseIndex}/sets/${setIndex}`, payload)

export const deleteSet = (sessionId: string, exerciseIndex: number, setIndex: number) =>
  client.delete<Session>(`/sessions/${sessionId}/exercises/${exerciseIndex}/sets/${setIndex}`)
