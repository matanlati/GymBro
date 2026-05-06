const RagRetrieverService = require('./RagRetrieverService')
const AiModelService = require('./AiModelService')
const PromptBuilder = require('./PromptBuilder')
const ResponseValidator = require('./ResponseValidator')

class WorkoutPlanService {
  async generatePlan(questionnaireData) {
    // Step 1: Convert questionnaire to search query
    const searchQuery = this.buildSearchQuery(questionnaireData)

    // Step 2: Retrieve relevant knowledge
    const retrievedContext = await RagRetrieverService.retrieve(searchQuery)

    // Step 3: Build prompt
    const prompt = PromptBuilder.buildPrompt(questionnaireData, retrievedContext)

    // Step 4: Call AI model
    const aiResponse = await AiModelService.generateResponse(prompt)

    // Step 5: Validate response
    const validatedResponse = ResponseValidator.validate(aiResponse)

    return validatedResponse
  }

  buildSearchQuery(questionnaireData) {
    return `${questionnaireData.trainingLevel} ${questionnaireData.fitnessGoal} workout plan ${questionnaireData.trainingDays} days per week ${questionnaireData.injuries ? 'with ' + questionnaireData.injuries : ''}`
  }
}

module.exports = new WorkoutPlanService()