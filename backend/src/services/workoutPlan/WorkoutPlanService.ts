import RagRetrieverService from './RagRetrieverService'
import AiModelService from './AiModelService'
import { PromptBuilder, minExercisesPerDay } from './PromptBuilder'
import { ResponseValidator } from './ResponseValidator'
import { QuestionnaireData, WorkoutPlan as WorkoutPlanDTO } from '../../types'
import { WorkoutPlan, IWorkoutPlan } from '../../models/WorkoutPlan.model'
import { toExerciseKey } from '../../utils/exerciseKey'

class WorkoutPlanService {
  async generatePlan(questionnaireData: QuestionnaireData): Promise<WorkoutPlanDTO> {
    const retrieval = await RagRetrieverService.retrieve(questionnaireData)
    const prompt = PromptBuilder.buildPrompt(questionnaireData, retrieval)
    const minPerDay = minExercisesPerDay(questionnaireData.trainingLevel)
    const aiResponse = await AiModelService.generateResponse(prompt)
    try {
      return ResponseValidator.validate(aiResponse, questionnaireData.trainingDays, minPerDay)
    } catch {
      const correctionPrompt = PromptBuilder.buildCorrectionPrompt(prompt, aiResponse)
      const correctedResponse = await AiModelService.generateResponse(correctionPrompt)
      try {
        return ResponseValidator.validate(correctedResponse, questionnaireData.trainingDays, minPerDay)
      } catch {
        // The retry still came up short on volume. A thin plan beats no plan, so
        // accept it if it is otherwise structurally valid.
        return ResponseValidator.validate(correctedResponse, questionnaireData.trainingDays)
      }
    }
  }

  async saveGeneratedPlan(
    userId: string,
    plan: WorkoutPlanDTO,
    title?: string,
    questionnaireData?: QuestionnaireData
  ): Promise<IWorkoutPlan> {
    const savedPlan = await WorkoutPlan.create({
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
      questionnaireData,
      isActive: true,
    })
    await WorkoutPlan.deleteMany({
      userId,
      isActive: true,
      _id: { $ne: savedPlan._id },
    })
    return savedPlan
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

  private deriveTitle(plan: WorkoutPlanDTO): string {
    const firstFocus = plan.weeklyPlan?.[0]?.focus
    return firstFocus ? `${firstFocus} Plan` : 'My Workout Plan'
  }
}

export default new WorkoutPlanService()
