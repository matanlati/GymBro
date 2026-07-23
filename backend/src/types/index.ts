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
  durationMinutes?: string
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

export type VideoFile = Express.Multer.File & { exerciseType?: string; side?: string }

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
  analized_video_url?: string
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

// These values are forwarded verbatim to the pose-estimation service as
// `exercise_type`, so they must match its registry keys exactly (see
// pose-estimation-service/src/exercises/__init__.py). The frontend dropdown maps
// each key to a human label.
export const ALLOWED_EXERCISE_TYPES = [
  'squat',
  'deadlift',
  'push-up',
  'lunge',
  'shoulder_press',
  'bicep_curl',
  'lateral_raise',
  'bench_press',
  'lat_pulldown',
  'triceps_extension',
] as const

export const ALLOWED_SIDES = ['left', 'right'] as const
