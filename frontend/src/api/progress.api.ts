import client from './client'

export interface PersonalRecord {
  exerciseName: string
  maxWeightKg: number
  achievedAt: string
  daysTracked: number
}

export interface ProgressSummary {
  totalSessions: number
  totalVolumeKg: number
  currentStreakDays: number
  personalRecords: PersonalRecord[]
}

export interface ExercisePoint {
  date: string
  maxWeightKg: number
  totalVolumeKg: number
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
