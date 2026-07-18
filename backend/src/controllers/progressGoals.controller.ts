import { Response } from 'express'
import { AuthRequest } from '../types'
import * as progressGoalsService from '../services/progressGoals.service'
import { ProgressGoalStatus } from '../models/ProgressGoal.model'

const handleError = (res: Response, err: unknown) => {
  const message = err instanceof Error ? err.message : 'Failed to process goal request'
  if (message === 'GOAL_NOT_FOUND') {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Goal not found' })
  }
  if (message === 'INVALID_GOAL_PAYLOAD' || message === 'INVALID_GOAL_STATUS') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid goal data' })
  }
  console.error('Progress goals controller error:', err)
  return res.status(500).json({ error: 'INTERNAL_ERROR', message })
}

export const listGoals = async (req: AuthRequest, res: Response) => {
  try {
    const status = typeof req.query.status === 'string'
      ? req.query.status as ProgressGoalStatus
      : undefined
    const goals = await progressGoalsService.listGoals(req.user!.userId, status)
    return res.json(goals)
  } catch (err) {
    return handleError(res, err)
  }
}

export const createGoal = async (req: AuthRequest, res: Response) => {
  try {
    const goal = await progressGoalsService.createGoal(req.user!.userId, req.body)
    return res.status(201).json(goal)
  } catch (err) {
    return handleError(res, err)
  }
}

export const updateGoal = async (req: AuthRequest, res: Response) => {
  try {
    const goal = await progressGoalsService.updateGoal(
      req.user!.userId,
      req.params.id,
      req.body
    )
    return res.json(goal)
  } catch (err) {
    return handleError(res, err)
  }
}

export const deleteGoal = async (req: AuthRequest, res: Response) => {
  try {
    await progressGoalsService.deleteGoal(req.user!.userId, req.params.id)
    return res.status(204).send()
  } catch (err) {
    return handleError(res, err)
  }
}
