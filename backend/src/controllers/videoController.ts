import fs from 'fs'
import { Request, Response } from 'express'
import { VideoFile } from '../types'

const VideoAnalysisService = process.env.VIDEO_ANALYSIS_SERVICE_URL
  ? require('../services/videoAnalysis/VideoAnalysisApiAdapter').default
  : require('../services/videoAnalysis/VideoAnalysisStubAdapter').default

export async function analyzeVideo(req: Request, res: Response): Promise<void> {
  const videoFile = req.file as VideoFile | undefined
  if (!videoFile) {
    res.status(400).json({ error: 'No video file provided' })
    return
  }

  try {
    videoFile.exerciseType = req.body?.exerciseType
    const result = await VideoAnalysisService.analyze(videoFile)
    res.json(result)
  } catch (error) {
    console.error('Video analysis error:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to analyze video' })
  } finally {
    fs.unlink(videoFile.path, (unlinkError) => {
      if (unlinkError) console.error('Failed to remove temp uploaded file:', unlinkError)
    })
  }
}
