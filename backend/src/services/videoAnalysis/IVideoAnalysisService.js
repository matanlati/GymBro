// Interface for Video Analysis Service
class IVideoAnalysisService {
  async analyze(videoFile) {
    throw new Error('analyze method must be implemented')
  }
}

module.exports = IVideoAnalysisService