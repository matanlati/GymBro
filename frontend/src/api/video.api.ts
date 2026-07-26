import client from './client'

export type Severity = 'low' | 'medium' | 'high'

export interface EvaluationIssue {
  title: string
  severity: Severity
  explanation: string
  suggestion: string
  // How many reps the fault touched; absent when the analyzer could not tell.
  affected_reps?: number
}

export interface Evaluation {
  exerciseType: string
  score: number
  isGoodTechnique: boolean
  scoreExplanation: string
  overallSummary: string
  positiveFeedback: string[]
  issues: EvaluationIssue[]
  // Fixes for what went wrong in this set...
  recommendations: string[]
  // ...versus general best-practice coaching for the lift.
  techniqueTips?: string[]
  dataReliabilityNote?: string
  cameraView?: string
  ignoredMetrics?: string[]
  analized_video_url?: string
}

export interface AnalyzeResponse {
  analysisId?: string
  evaluation: Evaluation
}

export interface RecentAnalysis {
  id: string
  exerciseName: string
  score: number
  summary: string
  issuesCount: number
  createdAt: string
}

export type BodySide = 'left' | 'right'

export const analyzeVideo = (file: File, exerciseType: string, side: BodySide) => {
  const form = new FormData()
  form.append('video', file)
  form.append('exerciseType', exerciseType)
  form.append('side', side)
  return client.post<AnalyzeResponse>('/video/analyze', form)
}

export const listAnalyses = () => client.get<RecentAnalysis[]>('/video/analyses')
