import { Response } from 'express'
import { AuthRequest } from '../types'
import * as progressService from '../services/progress.service'

const handleError = (res: Response, err: unknown) => {
  const message = err instanceof Error ? err.message : 'Failed to process progress request'
  console.error('Progress controller error:', err)
  return res.status(500).json({ error: 'INTERNAL_ERROR', message })
}

export const getSummary = async (req: AuthRequest, res: Response) => {
  try {
    const summary = await progressService.getSummary(req.user!.userId)
    return res.json(summary)
  } catch (err) {
    return handleError(res, err)
  }
}

export const getExerciseSeries = async (req: AuthRequest, res: Response) => {
  const name = req.params.name?.trim()
  if (!name) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'exercise name is required' })
  }
  try {
    const series = await progressService.getExerciseSeries(req.user!.userId, name)
    return res.json(series)
  } catch (err) {
    return handleError(res, err)
  }
}

export const getHistory = async (req: AuthRequest, res: Response) => {
  const page = req.query.page !== undefined ? Number(req.query.page) : undefined
  const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined

  if ((page !== undefined && !Number.isFinite(page)) || (limit !== undefined && !Number.isFinite(limit))) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'page and limit must be numbers' })
  }
  try {
    const history = await progressService.getHistory(req.user!.userId, page, limit)
    return res.json(history)
  } catch (err) {
    return handleError(res, err)
  }
}
