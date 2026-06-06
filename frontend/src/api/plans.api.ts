import client from './client'

export interface QuestionnaireData {
  age?: string | number
  gender?: string
  height?: string | number
  weight?: string | number
  fitnessGoal?: string
  trainingLevel?: string
  trainingDays?: string | number
  injuries?: string
  preferredWorkoutType?: string
  equipmentAvailable?: string
}

export interface PlanExercise {
  name: string
  sets: string
  reps: string
  notes?: string
}

export interface PlanDay {
  day: string
  focus: string
  exercises: PlanExercise[]
}

export interface WorkoutPlan {
  _id: string
  userId: string
  title: string
  programType?: string
  summary: string
  weeklyPlan: PlanDay[]
  safetyNotes: string[]
  progressionNotes: string
  isActive: boolean
  createdAt: string
}

export function generatePlan(data: QuestionnaireData) {
  return client.post<WorkoutPlan>('/plans/generate', data)
}

export function getActivePlan() {
  return client.get<WorkoutPlan>('/plans/active')
}

export function listPlans() {
  return client.get<WorkoutPlan[]>('/plans')
}

export function activatePlan(id: string) {
  return client.post<WorkoutPlan>(`/plans/${id}/activate`)
}

export function deletePlan(id: string) {
  return client.delete<void>(`/plans/${id}`)
}
