import client from './client'

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

export const analyzeVideo = (file: File, exerciseType: string) => {
  const form = new FormData()
  form.append('video', file)
  form.append('exerciseType', exerciseType)
  return client.post<AnalyzeResponse>('/video/analyze', form)
}

export const listAnalyses = () => client.get<RecentAnalysis[]>('/video/analyses')
