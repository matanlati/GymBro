import RagRetrieverService from './RagRetrieverService'
import AiModelService from './AiModelService'
import { PromptBuilder } from './PromptBuilder'
import { ResponseValidator } from './ResponseValidator'
import { QuestionnaireData, WorkoutPlan } from '../../types'

class WorkoutPlanService {
  async generatePlan(questionnaireData: QuestionnaireData): Promise<WorkoutPlan> {
    const searchQuery = this.buildSearchQuery(questionnaireData)
    const retrievedContext = await RagRetrieverService.retrieve(searchQuery)
    const prompt = PromptBuilder.buildPrompt(questionnaireData, retrievedContext)
    const aiResponse = await AiModelService.generateResponse(prompt)
    return ResponseValidator.validate(aiResponse)
  }

  private buildSearchQuery(data: QuestionnaireData): string {
    return `${data.trainingLevel} ${data.fitnessGoal} workout plan ${data.trainingDays} days per week${data.injuries ? ' with ' + data.injuries : ''}`
  }
}

export default new WorkoutPlanService()
