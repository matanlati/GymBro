const fs = require('fs')
const VideoAnalysisService = process.env.VIDEO_ANALYSIS_SERVICE_URL
  ? require('../services/videoAnalysis/VideoAnalysisApiAdapter')
  : require('../services/videoAnalysis/VideoAnalysisStubAdapter')

const videoController = {
  analyzeVideo: async (req, res) => {
    const videoFile = req.file
    if (!videoFile) {
      return res.status(400).json({ error: 'No video file provided' })
    }

    try {
      const result = await VideoAnalysisService.analyze(videoFile)
      res.json(result)
    } catch (error) {
      console.error('Video analysis error:', error)
      res.status(500).json({ error: error.message || 'Failed to analyze video' })
    } finally {
      fs.unlink(videoFile.path, (unlinkError) => {
        if (unlinkError) {
          console.error('Failed to remove temp uploaded file:', unlinkError)
        }
      })
    }
  }
}

module.exports = videoController