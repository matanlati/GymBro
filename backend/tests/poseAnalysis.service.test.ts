jest.mock('../src/models/PoseAnalysis.model')

import { PoseAnalysis } from '../src/models/PoseAnalysis.model'
import PoseAnalysisService from '../src/services/videoAnalysis/PoseAnalysisService'
import { Evaluation } from '../src/types'

const MockPoseAnalysis = PoseAnalysis as jest.Mocked<typeof PoseAnalysis>

const sampleEvaluation: Evaluation = {
  exerciseType: 'push-up',
  score: 72,
  isGoodTechnique: true,
  scoreExplanation: 'why',
  overallSummary: 'a paragraph summary',
  positiveFeedback: ['good rom'],
  issues: [
    { title: 'lean', severity: 'medium', explanation: 'e', suggestion: 's' },
    { title: 'depth', severity: 'high', explanation: 'e', suggestion: 's' },
  ],
  recommendations: ['plank'],
  cameraView: 'FRONT_VIEW',
}

describe('PoseAnalysisService.saveAnalysis', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(MockPoseAnalysis.create as jest.Mock) = jest
      .fn()
      .mockImplementation(async (doc) => ({ _id: 'pa1', ...doc }))
  })

  it('maps overallSummary to summary and issues.length to issuesCount', async () => {
    await PoseAnalysisService.saveAnalysis('user1', 'push-up', 'clip.mp4', sampleEvaluation)

    const arg = (MockPoseAnalysis.create as jest.Mock).mock.calls[0][0]
    expect(arg.summary).toBe('a paragraph summary')
    expect(arg.issuesCount).toBe(2)
    expect(arg.status).toBe('done')
    expect(arg.userId).toBe('user1')
    expect(arg.exerciseName).toBe('push-up')
    expect(arg.score).toBe(72)
    expect(arg.videoPath).toBe('clip.mp4')
    expect(arg.evaluation).toBe(sampleEvaluation)
  })

  it('prefers the evaluation exerciseType over the request exerciseType', async () => {
    await PoseAnalysisService.saveAnalysis('user1', 'squat', 'clip.mp4', sampleEvaluation)
    const arg = (MockPoseAnalysis.create as jest.Mock).mock.calls[0][0]
    expect(arg.exerciseName).toBe('push-up')
  })

  it('defaults issuesCount to 0 when issues is missing', async () => {
    const noIssues = { ...sampleEvaluation, issues: undefined } as unknown as Evaluation
    await PoseAnalysisService.saveAnalysis('user1', 'push-up', undefined, noIssues)
    const arg = (MockPoseAnalysis.create as jest.Mock).mock.calls[0][0]
    expect(arg.issuesCount).toBe(0)
  })
})

describe('PoseAnalysisService.listRecent', () => {
  it('queries the user, sorts by createdAt desc and limits', async () => {
    const limit = jest.fn().mockResolvedValue([{ _id: 'pa1' }])
    const sort = jest.fn().mockReturnValue({ limit })
    ;(MockPoseAnalysis.find as jest.Mock) = jest.fn().mockReturnValue({ sort })

    const result = await PoseAnalysisService.listRecent('user1')

    expect(MockPoseAnalysis.find).toHaveBeenCalledWith({ userId: 'user1' })
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 })
    expect(limit).toHaveBeenCalledWith(10)
    expect(result).toEqual([{ _id: 'pa1' }])
  })
})

describe('PoseAnalysisService.toRecentDto', () => {
  it('shapes a document into the list DTO', () => {
    const createdAt = new Date('2026-06-06T10:00:00.000Z')
    const dto = PoseAnalysisService.toRecentDto({
      _id: 'pa1',
      exerciseName: 'squat',
      score: 92,
      summary: 'great depth',
      issuesCount: 0,
      createdAt,
    } as never)

    expect(dto).toEqual({
      id: 'pa1',
      exerciseName: 'squat',
      score: 92,
      summary: 'great depth',
      issuesCount: 0,
      createdAt: '2026-06-06T10:00:00.000Z',
    })
  })
})
