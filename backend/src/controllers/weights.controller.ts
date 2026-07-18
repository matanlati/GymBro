import { Response } from 'express'
import { AuthRequest } from '../types'
import * as weightsService from '../services/weights.service'

export async function listWeights(req: AuthRequest, res: Response) {
  const entries = await weightsService.listWeights(req.user!.userId)
  return res.json(entries)
}

export async function createWeight(req: AuthRequest, res: Response) {
  try {
    const entry = await weightsService.createWeight(req.user!.userId, req.body)
    return res.status(201).json(entry)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'INVALID_WEIGHT') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Enter a weight between 20 and 400 kg' })
    }
    if (err instanceof Error && err.message === 'INVALID_DATE') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Enter a valid weigh-in date' })
    }
    throw err
  }
}
