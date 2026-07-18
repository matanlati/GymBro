import client from './client'

export interface PersonalRecord {
  exerciseKey: string
  exerciseName: string
  maxWeightKg: number
  achievedAt: string
  daysTracked: number
}

export interface BodyweightRecord {
  exerciseKey: string
  exerciseName: string
  maxReps: number
  achievedAt: string
  daysTracked: number
}

export interface StrengthProgress {
  exerciseKey: string
  exerciseName: string
  currentEstimatedOneRepMaxKg: number
  improvementPercent: number
  latestWorkoutAt: string
  daysTracked: number
}

export interface WeeklyActivity {
  weekStart: string
  weekEnd: string
  workoutCount: number
}

export interface ProgressSummary {
  totalSessions: number
  totalVolumeKg: number
  averageDurationMinutes: number
  currentStreakDays: number
  bestStreakDays: number
  weeklyActivity: WeeklyActivity[]
  personalRecords: PersonalRecord[]
  bodyweightRecords: BodyweightRecord[]
  strengthProgress: StrengthProgress[]
}

export interface ExercisePoint {
  date: string
  maxWeightKg: number
  estimatedOneRepMaxKg: number
  totalVolumeKg: number
}

export type ProgressGoalType =
  | 'weekly_workouts'
  | 'exercise_strength'
  | 'body_weight'
  | 'muscle_mass'
export type ProgressGoalStatus = 'active' | 'completed' | 'archived'
export type ProgressGoalUnit = 'workouts' | 'kg'

export interface ProgressGoal {
  _id: string
  userId: string
  type: ProgressGoalType
  exerciseKey?: string
  exerciseName?: string
  baselineValue?: number
  targetValue: number
  unit: ProgressGoalUnit
  startsAt: string
  targetDate?: string
  status: ProgressGoalStatus
  completedAt?: string
  currentValue: number | null
  progressPercent: number | null
  createdAt: string
  updatedAt: string
}

export interface CreateProgressGoalPayload {
  type: ProgressGoalType
  exerciseName?: string
  baselineValue?: number
  targetValue: number
  startsAt?: string
  targetDate?: string
}

export interface UpdateProgressGoalPayload {
  exerciseName?: string
  baselineValue?: number
  targetValue?: number
  targetDate?: string
  status?: ProgressGoalStatus
}

export type AchievementCategory = 'workout_count' | 'streak' | 'personal_record'

export interface AchievementUnlock {
  _id: string
  userId: string
  achievementKey: string
  category: AchievementCategory
  value: number
  exerciseKey?: string
  exerciseName?: string
  unlockedAt: string
  createdAt: string
}

export interface BodyMeasurement {
  _id: string
  userId: string
  measuredAt: string
  weightKg?: number
  bodyFatPercent?: number
  muscleMassKg?: number
  createdAt: string
  updatedAt: string
}

export interface BodyMeasurementPayload {
  measuredAt?: string
  weightKg?: number
  bodyFatPercent?: number
  muscleMassKg?: number
}

export interface HistoryItem {
  sessionId: string
  scheduledDate: string
  completedAt: string
  dayIndex: number
  exerciseCount: number
  totalVolumeKg: number
}

export interface HistoryPage {
  items: HistoryItem[]
  page: number
  limit: number
  total: number
}

export const getSummary = () => client.get<ProgressSummary>('/progress/summary')

export const getExerciseSeries = (name: string) =>
  client.get<ExercisePoint[]>(`/progress/exercise/${encodeURIComponent(name)}`)

export const getHistory = (page = 1, limit = 20) =>
  client.get<HistoryPage>('/progress/history', { params: { page, limit } })

export const listGoals = (status?: ProgressGoalStatus) =>
  client.get<ProgressGoal[]>('/progress/goals', { params: status ? { status } : undefined })

export const createGoal = (payload: CreateProgressGoalPayload) =>
  client.post<ProgressGoal>('/progress/goals', payload)

export const updateGoal = (id: string, payload: UpdateProgressGoalPayload) =>
  client.patch<ProgressGoal>(`/progress/goals/${id}`, payload)

export const deleteGoal = (id: string) =>
  client.delete(`/progress/goals/${id}`)

export const listAchievements = (category?: AchievementCategory, limit = 20) =>
  client.get<AchievementUnlock[]>('/progress/achievements', {
    params: { ...(category ? { category } : {}), limit },
  })

export const listMeasurements = (params?: { from?: string; to?: string; limit?: number }) =>
  client.get<BodyMeasurement[]>('/progress/measurements', { params })

export const createMeasurement = (payload: BodyMeasurementPayload) =>
  client.post<BodyMeasurement>('/progress/measurements', payload)

export const updateMeasurement = (id: string, payload: BodyMeasurementPayload) =>
  client.patch<BodyMeasurement>(`/progress/measurements/${id}`, payload)

export const deleteMeasurement = (id: string) =>
  client.delete(`/progress/measurements/${id}`)
