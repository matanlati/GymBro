import fs from 'fs'
import { Response } from 'express'
import { AuthRequest, VideoFile, Evaluation, ALLOWED_EXERCISE_TYPES, ALLOWED_SIDES } from '../types'
import PoseAnalysisService from '../services/videoAnalysis/PoseAnalysisService'
import AnalysisCacheService from '../services/videoAnalysis/AnalysisCacheService'
import { streamVideoFromService, toBackendVideoUrl, isSafeFilename } from '../services/videoAnalysis/videoProxy'

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

    // The pipeline is a pure function of (video bytes, exerciseType, side), so an
    // identical upload can reuse a stored result instead of re-running it. A hashing
    // or lookup failure must degrade to a normal analysis, never fail the request.
    let cacheKey: string | null = null
    let hit: Evaluation | null = null
    try {
      const hash = await AnalysisCacheService.hashFile(videoFile.path)
      videoFile.outputFilename = AnalysisCacheService.outputFilename(hash, exerciseType, side)
      cacheKey = AnalysisCacheService.buildKey(hash, exerciseType, side)
      hit = await AnalysisCacheService.get(cacheKey)
    } catch (cacheError) {
      console.error('Analysis cache lookup failed:', cacheError)
    }

    let evaluation: Evaluation
    if (hit) {
      console.log(`Analysis cache hit for ${cacheKey}`)
      evaluation = hit
    } else {
      const result = await VideoAnalysisService.analyze(videoFile)
      const analyzed = extractEvaluation(result)
      if (!analyzed) {
        res.status(502).json({ error: 'BAD_GATEWAY', message: 'Evaluator returned no evaluation' })
        return
      }

      // The microservice returns an internal URL (e.g. http://localhost:8000/videos/x.mp4)
      // the browser can't reach. Rewrite it to a backend stream endpoint that proxies it.
      analyzed.analized_video_url = toBackendVideoUrl(analyzed.analized_video_url)
      evaluation = analyzed

      if (cacheKey) {
        try {
          await AnalysisCacheService.set(cacheKey, evaluation)
        } catch (cacheError) {
          console.error('Failed to store analysis in cache:', cacheError)
        }
      }
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

    res.json({ analysisId, evaluation, ...(hit ? { cached: true } : {}) })
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

// Proxy an annotated video from the pose-estimation microservice so the
// browser never talks to the internal service directly.
export const streamVideo = async (req: AuthRequest, res: Response): Promise<void> => {
  const { filename } = req.params
  if (!filename || !isSafeFilename(filename)) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid video filename' })
    return
  }
  try {
    streamVideoFromService(filename, req, res)
  } catch (error) {
    console.error('Failed to stream analyzed video:', error)
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Failed to stream video',
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
