import { QuestionnaireData } from '../../types'
import ExerciseRetriever, { EMPTY_RESULT, RetrievalResult } from './ExerciseRetriever'

class RagRetrieverService {
  /**
   * Two-stage retrieval: hard metadata filters (equipment, level, injury
   * contraindications) followed by per-muscle-group vector ranking.
   *
   * Never throws — if the embedding endpoint is unavailable this returns an
   * empty result and generation proceeds exactly as it did before RAG.
   */
  async retrieve(questionnaireData: QuestionnaireData): Promise<RetrievalResult> {
    if (!questionnaireData || typeof questionnaireData !== 'object') return EMPTY_RESULT
    return ExerciseRetriever.retrieve(questionnaireData)
  }
}

export default new RagRetrieverService()
