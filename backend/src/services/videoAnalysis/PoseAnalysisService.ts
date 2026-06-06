import { PoseAnalysis, IPoseAnalysis } from '../../models/PoseAnalysis.model'
import { Evaluation, RecentAnalysis } from '../../types'

class PoseAnalysisService {
  async saveAnalysis(
    userId: string,
    exerciseType: string,
    videoPath: string | undefined,
    evaluation: Evaluation
  ): Promise<IPoseAnalysis> {
    return PoseAnalysis.create({
      userId,
      exerciseName: evaluation.exerciseType || exerciseType,
      score: evaluation.score,
      isGoodTechnique: evaluation.isGoodTechnique,
      summary: evaluation.overallSummary,
      issuesCount: evaluation.issues?.length ?? 0,
      cameraView: evaluation.cameraView,
      status: 'done',
      videoPath,
      evaluation,
    })
  }

  async listRecent(userId: string, limit = 10): Promise<IPoseAnalysis[]> {
    return PoseAnalysis.find({ userId }).sort({ createdAt: -1 }).limit(limit)
  }

  toRecentDto(doc: IPoseAnalysis): RecentAnalysis {
    return {
      id: String(doc._id),
      exerciseName: doc.exerciseName,
      score: doc.score,
      summary: doc.summary,
      issuesCount: doc.issuesCount,
      createdAt: doc.createdAt.toISOString(),
    }
  }
}

export default new PoseAnalysisService()
