import { Request } from 'express'

export interface AuthRequest extends Request {
  user?: { userId: string; email: string }
}

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

export interface Exercise {
  name: string
  sets: string
  reps: string
  notes?: string
}

export interface DayPlan {
  day: string
  focus: string
  exercises: Exercise[]
}

export interface WorkoutPlan {
  summary: string
  weeklyPlan: DayPlan[]
  safetyNotes: string[]
  progressionNotes: string
}

export type VideoFile = Express.Multer.File & { exerciseType?: string }
