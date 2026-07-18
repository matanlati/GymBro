import fs from 'fs'
import { Response } from 'express'
import { AuthRequest, VideoFile, Evaluation, ALLOWED_EXERCISE_TYPES, ALLOWED_SIDES } from '../types'
import PoseAnalysisService from '../services/videoAnalysis/PoseAnalysisService'

const VideoAnalysisService = process.env.VIDEO_ANALYSIS_SERVICE_URL
  ? require('../services/videoAnalysis/VideoAnalysisApiAdapter').default
  : require('../services/videoAnalysis/VideoAnalysisStubAdapter').default

// Accept either the wrapped `{ evaluation }` envelope or a bare evaluation object.
const extractEvaluation = (result: unknown): Evaluation | null => {
  if (!result || typeof result !== 'object') return null
  const obj = result as Record<string, unknown>
  const candidate = (obj.evaluation ?? obj) as Record<string, unknown>
  if (typeof candidate.score === 'number' && typeof candidate.exerciseType === 'string') {
    return candidate as unknown as Evaluation
  }
  return null
}

export const analyzeVideo = async (req: AuthRequest, res: Response): Promise<void> => {
  const videoFile = req.file as VideoFile | undefined
  if (!videoFile) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'No video file provided' })
    return
  }

  const exerciseType = req.body?.exerciseType
  if (!exerciseType || !ALLOWED_EXERCISE_TYPES.includes(exerciseType)) {
    fs.unlink(videoFile.path, () => {})
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: `exerciseType must be one of: ${ALLOWED_EXERCISE_TYPES.join(', ')}`,
    })
    return
  }

  const side = req.body?.side
  if (side !== undefined && !ALLOWED_SIDES.includes(side)) {
    fs.unlink(videoFile.path, () => {})
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: `side must be one of: ${ALLOWED_SIDES.join(', ')}`,
    })
    return
  }

  try {
    videoFile.exerciseType = exerciseType
    if (side) videoFile.side = side
    const result = await VideoAnalysisService.analyze(videoFile)
    const evaluation = extractEvaluation(result)
    if (!evaluation) {
      res.status(502).json({ error: 'BAD_GATEWAY', message: 'Evaluator returned no evaluation' })
      return
    }

    // Persistence failure must not lose the result the user is waiting on.
    let analysisId: string | undefined
    try {
      const saved = await PoseAnalysisService.saveAnalysis(
        req.user!.userId,
        exerciseType,
        evaluation.analized_video_url ?? videoFile.originalname,
        evaluation
      )
      analysisId = String(saved._id)
    } catch (saveError) {
      console.error('Failed to persist pose analysis:', saveError)
    }

    res.json({ analysisId, evaluation })
  } catch (error) {
    console.error('Video analysis error:', error)
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Failed to analyze video',
    })
  } finally {
    fs.unlink(videoFile.path, (unlinkError) => {
      if (unlinkError) console.error('Failed to remove temp uploaded file:', unlinkError)
    })
  }
}

export const listAnalyses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const docs = await PoseAnalysisService.listRecent(req.user!.userId)
    res.json(docs.map((doc) => PoseAnalysisService.toRecentDto(doc)))
  } catch (error) {
    console.error('Failed to list pose analyses:', error)
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Failed to list analyses',
    })
  }
}
