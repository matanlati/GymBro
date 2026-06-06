import { Request, Response } from 'express'
import WorkoutPlanService from '../services/workoutPlan/WorkoutPlanService'
import { QuestionnaireData } from '../types'

export async function generateWorkoutPlan(req: Request, res: Response): Promise<void> {
  try {
    const questionnaireData = req.body as QuestionnaireData
    const workoutPlan = await WorkoutPlanService.generatePlan(questionnaireData)
    res.json(workoutPlan)
  } catch (error) {
    console.error('Workout plan generation error:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate workout plan' })
  }
}
