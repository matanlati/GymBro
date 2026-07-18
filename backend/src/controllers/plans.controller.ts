import { Response } from 'express'
import { AuthRequest, QuestionnaireData } from '../types'
import WorkoutPlanService from '../services/workoutPlan/WorkoutPlanService'
import * as usersService from '../services/users.service'

function notFound(res: Response, message = 'Plan not found') {
  return res.status(404).json({ error: 'NOT_FOUND', message })
}

function forbidden(res: Response) {
  return res.status(403).json({ error: 'FORBIDDEN', message: 'You do not own this plan' })
}

function serverError(res: Response, err: unknown) {
  console.error('Plans controller error:', err)
  const message = err instanceof Error ? err.message : 'Failed to process plan request'
  return res.status(500).json({ error: 'INTERNAL_ERROR', message })
}

export async function listPlans(req: AuthRequest, res: Response) {
  try {
    const plans = await WorkoutPlanService.listPlans(req.user!.userId)
    return res.json(plans)
  } catch (err) {
    return serverError(res, err)
  }
}

export async function getActivePlan(req: AuthRequest, res: Response) {
  try {
    const plan = await WorkoutPlanService.getActivePlan(req.user!.userId)
    if (!plan) return notFound(res, 'No active plan')
    return res.json(plan)
  } catch (err) {
    return serverError(res, err)
  }
}

export async function generateAndSavePlan(req: AuthRequest, res: Response) {
  const data = req.body as QuestionnaireData
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Questionnaire data is required' })
  }
  if (!data.fitnessGoal || !data.trainingLevel || !data.trainingDays) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'fitnessGoal, trainingLevel and trainingDays are required',
    })
  }

  try {
    const generated = await WorkoutPlanService.generatePlan(data)
    const saved = await WorkoutPlanService.saveGeneratedPlan(req.user!.userId, generated, undefined, data)
    await usersService.updateMe(req.user!.userId, {
      age: data.age !== undefined && data.age !== '' ? Number(data.age) : undefined,
      weightKg: data.weight !== undefined && data.weight !== '' ? Number(data.weight) : undefined,
      heightCm: data.height !== undefined && data.height !== '' ? Number(data.height) : undefined,
      fitnessLevel: data.trainingLevel,
      goals: data.fitnessGoal,
      limitations: data.injuries,
    })
    return res.status(201).json(saved)
  } catch (err) {
    return serverError(res, err)
  }
}

export async function activatePlan(req: AuthRequest, res: Response) {
  try {
    const plan = await WorkoutPlanService.activatePlan(req.user!.userId, req.params.id)
    return res.json(plan)
  } catch (err) {
    if (err instanceof Error && err.message === 'PLAN_NOT_FOUND') return notFound(res)
    if (err instanceof Error && err.message === 'FORBIDDEN') return forbidden(res)
    return serverError(res, err)
  }
}

export async function deletePlan(req: AuthRequest, res: Response) {
  try {
    await WorkoutPlanService.deletePlan(req.user!.userId, req.params.id)
    return res.status(204).send()
  } catch (err) {
    if (err instanceof Error && err.message === 'PLAN_NOT_FOUND') return notFound(res)
    if (err instanceof Error && err.message === 'FORBIDDEN') return forbidden(res)
    return serverError(res, err)
  }
}
