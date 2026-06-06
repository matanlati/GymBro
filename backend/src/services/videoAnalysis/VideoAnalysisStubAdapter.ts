import { IVideoAnalysisService } from './IVideoAnalysisService'
import { VideoFile, VideoAnalysisResult } from '../../types'

class VideoAnalysisStubAdapter extends IVideoAnalysisService {
  async analyze(videoFile: VideoFile): Promise<VideoAnalysisResult> {
    console.log('VideoAnalysisStubAdapter: Analyzing video file:', videoFile.originalname)
    await new Promise(resolve => setTimeout(resolve, 2000))

    const exerciseType = videoFile.exerciseType || 'push-up'
    // Vary the score a little so the UI shows the badge color tiers while developing.
    const score = 60 + Math.floor(Math.random() * 35)
    const isGoodTechnique = score >= 70

    return {
      evaluation: {
        exerciseType,
        score,
        isGoodTechnique,
        scoreExplanation:
          'The rep shows good range of motion and generally smooth control, but torso lean is outside the optimal range, indicating a need for better body alignment.',
        overallSummary:
          'The user demonstrates adequate mechanics with sufficient joint motion and a smooth tempo, yet the torso leans excessively, which can reduce efficiency and increase strain.',
        positiveFeedback: [
          'Good elbow and shoulder range of motion (73.8° and 57.6° range)',
          'Movement appears smooth despite low confidence in the control metric',
        ],
        issues: isGoodTechnique
          ? [
              {
                title: 'Excessive torso lean',
                severity: 'medium',
                explanation:
                  'Average torso lean is 84.7°, interpreted as problematic, suggesting the body is not kept in a straight line.',
                suggestion:
                  'Engage the core and keep the body in a straight plank position; avoid sagging hips or raising the buttocks.',
              },
            ]
          : [
              {
                title: 'Shallow range of motion',
                severity: 'high',
                explanation: 'The movement does not reach full depth on most reps.',
                suggestion: 'Slow down and aim for full range on each rep before returning.',
              },
              {
                title: 'Excessive torso lean',
                severity: 'medium',
                explanation: 'The torso drifts out of a neutral line under load.',
                suggestion: 'Brace the core and keep a straight line from head to hips.',
              },
            ],
        recommendations: [
          'Practice plank holds to reinforce a neutral spine',
          'Focus on core activation during each rep',
          'Consider reducing depth slightly until alignment improves',
        ],
        dataReliabilityNote:
          'Camera view confidence is moderate (0.67) and about half of the joint angles are missing, especially on the left side, so the evaluation carries some uncertainty.',
        cameraView: 'FRONT_VIEW',
        ignoredMetrics: ['leftRightSymmetry'],
      },
    }
  }
}

export default new VideoAnalysisStubAdapter()
