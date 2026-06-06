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

export type Severity = 'low' | 'medium' | 'high'

export interface EvaluationIssue {
  title: string
  severity: Severity
  explanation: string
  suggestion: string
}

export interface Evaluation {
  exerciseType: string
  score: number
  isGoodTechnique: boolean
  scoreExplanation: string
  overallSummary: string
  positiveFeedback: string[]
  issues: EvaluationIssue[]
  recommendations: string[]
  dataReliabilityNote?: string
  cameraView?: string
  ignoredMetrics?: string[]
}

// The envelope the evaluator service returns. The evaluation lives under `evaluation`.
export interface VideoAnalysisResult {
  evaluation: Evaluation
}

// What the API returns to the frontend after persisting.
export interface AnalyzeResponse {
  analysisId?: string
  evaluation: Evaluation
}

// Row shape for the Recent Analyses list.
export interface RecentAnalysis {
  id: string
  exerciseName: string
  score: number
  summary: string
  issuesCount: number
  createdAt: string
}

export const ALLOWED_EXERCISE_TYPES = [
  'squat',
  'deadlift',
  'push-up',
  'lunge',
  'shoulder press',
  'biceps curl',
] as const
