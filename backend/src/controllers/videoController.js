const VideoAnalysisService = require('../services/videoAnalysis/VideoAnalysisStubAdapter')

const videoController = {
  analyzeVideo: async (req, res) => {
    try {
      const videoFile = req.file
      if (!videoFile) {
        return res.status(400).json({ error: 'No video file provided' })
      }

      const result = await VideoAnalysisService.analyze(videoFile)
      res.json(result)
    } catch (error) {
      console.error('Video analysis error:', error)
      res.status(500).json({ error: 'Failed to analyze video' })
    }
  }
}

module.exports = videoController