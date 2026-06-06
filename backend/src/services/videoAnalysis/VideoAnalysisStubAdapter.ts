import { IVideoAnalysisService } from './IVideoAnalysisService'
import { VideoFile } from '../../types'

class VideoAnalysisStubAdapter extends IVideoAnalysisService {
  async analyze(videoFile: VideoFile): Promise<unknown> {
    console.log('VideoAnalysisStubAdapter: Analyzing video file:', videoFile.originalname)
    await new Promise(resolve => setTimeout(resolve, 2000))
    return {
      analysis: 'Video analysis completed (STUB)',
      detectedExercises: ['Push-ups', 'Squats'],
      formFeedback: 'Good form overall, but improve squat depth.',
      confidence: 0.85,
    }
  }
}

export default new VideoAnalysisStubAdapter()
