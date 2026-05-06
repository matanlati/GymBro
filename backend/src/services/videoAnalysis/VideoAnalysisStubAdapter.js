const IVideoAnalysisService = require('./IVideoAnalysisService')

class VideoAnalysisStubAdapter extends IVideoAnalysisService {
  async analyze(videoFile) {
    // STUB IMPLEMENTATION
    // TODO: Replace this stub with real video analysis model integration
    // The real implementation should:
    // 1. Process the video file (videoFile.path contains the uploaded file path)
    // 2. Send it to the video analysis model (e.g., via API call to another service)
    // 3. Receive and return the analysis results

    console.log('VideoAnalysisStubAdapter: Analyzing video file:', videoFile.originalname)

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Mock response - replace with real model output
    const mockResult = {
      analysis: 'Video analysis completed (STUB)',
      detectedExercises: ['Push-ups', 'Squats'],
      formFeedback: 'Good form overall, but improve squat depth.',
      confidence: 0.85
    }

    return mockResult
  }
}

module.exports = new VideoAnalysisStubAdapter()