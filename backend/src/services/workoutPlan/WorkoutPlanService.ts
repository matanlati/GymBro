import RagRetrieverService from './RagRetrieverService'
import AiModelService from './AiModelService'
import { PromptBuilder } from './PromptBuilder'
import { ResponseValidator } from './ResponseValidator'
import { QuestionnaireData, WorkoutPlan as WorkoutPlanDTO } from '../../types'
import { WorkoutPlan, IWorkoutPlan } from '../../models/WorkoutPlan.model'
import { toExerciseKey } from '../../utils/exerciseKey'

class WorkoutPlanService {
  async generatePlan(questionnaireData: QuestionnaireData): Promise<WorkoutPlanDTO> {
    const searchQuery = this.buildSearchQuery(questionnaireData)
    const retrievedContext = await RagRetrieverService.retrieve(searchQuery)
    const prompt = PromptBuilder.buildPrompt(questionnaireData, retrievedContext)
    const aiResponse = await AiModelService.generateResponse(prompt)
    return ResponseValidator.validate(aiResponse)
  }

  async saveGeneratedPlan(
    userId: string,
    plan: WorkoutPlanDTO,
    title?: string
  ): Promise<IWorkoutPlan> {
    await WorkoutPlan.updateMany({ userId }, { $set: { isActive: false } })
    return WorkoutPlan.create({
      userId,
      title: title ?? this.deriveTitle(plan),
      summary: plan.summary,
      weeklyPlan: plan.weeklyPlan.map(day => ({
        ...day,
        exercises: day.exercises.map(exercise => ({
          ...exercise,
          exerciseKey: toExerciseKey(exercise.name),
        })),
      })),
      safetyNotes: plan.safetyNotes,
      progressionNotes: plan.progressionNotes,
      isActive: true,
    })
  }

  async getActivePlan(userId: string): Promise<IWorkoutPlan | null> {
    return WorkoutPlan.findOne({ userId, isActive: true })
  }

  async listPlans(userId: string): Promise<IWorkoutPlan[]> {
    return WorkoutPlan.find({ userId }).sort({ createdAt: -1 })
  }

  async activatePlan(userId: string, planId: string): Promise<IWorkoutPlan> {
    const plan = await WorkoutPlan.findById(planId)
    if (!plan) throw new Error('PLAN_NOT_FOUND')
    if (plan.userId.toString() !== userId) throw new Error('FORBIDDEN')

    await WorkoutPlan.updateMany({ userId }, { $set: { isActive: false } })
    plan.isActive = true
    return plan.save()
  }

  async deletePlan(userId: string, planId: string): Promise<void> {
    const plan = await WorkoutPlan.findById(planId)
    if (!plan) throw new Error('PLAN_NOT_FOUND')
    if (plan.userId.toString() !== userId) throw new Error('FORBIDDEN')
    await plan.deleteOne()
  }

  private buildSearchQuery(data: QuestionnaireData): string {
    return `${data.trainingLevel} ${data.fitnessGoal} workout plan ${data.trainingDays} days per week${data.injuries ? ' with ' + data.injuries : ''}`
  }

  private deriveTitle(plan: WorkoutPlanDTO): string {
    const firstFocus = plan.weeklyPlan?.[0]?.focus
    return firstFocus ? `${firstFocus} Plan` : 'My Workout Plan'
  }
}

export default new WorkoutPlanService()
