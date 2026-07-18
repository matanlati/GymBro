import { Response } from 'express'
import { AuthRequest } from '../types'
import * as bodyMeasurementsService from '../services/bodyMeasurements.service'

const handleError = (res: Response, err: unknown) => {
  const message = err instanceof Error ? err.message : 'Failed to process measurement request'
  if (message === 'MEASUREMENT_NOT_FOUND') {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Measurement not found' })
  }
  if (
    message === 'INVALID_MEASUREMENT_PAYLOAD' ||
    message === 'INVALID_MEASUREMENT_FILTERS' ||
    (err instanceof Error && err.name === 'ValidationError')
  ) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid measurement data' })
  }
  console.error('Body measurements controller error:', err)
  return res.status(500).json({ error: 'INTERNAL_ERROR', message })
}

export const listMeasurements = async (req: AuthRequest, res: Response) => {
  try {
    const measurements = await bodyMeasurementsService.listMeasurements(req.user!.userId, {
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
    })
    return res.json(measurements)
  } catch (err) {
    return handleError(res, err)
  }
}

export const createMeasurement = async (req: AuthRequest, res: Response) => {
  try {
    const measurement = await bodyMeasurementsService.createMeasurement(
      req.user!.userId,
      req.body
    )
    return res.status(201).json(measurement)
  } catch (err) {
    return handleError(res, err)
  }
}

export const updateMeasurement = async (req: AuthRequest, res: Response) => {
  try {
    const measurement = await bodyMeasurementsService.updateMeasurement(
      req.user!.userId,
      req.params.id,
      req.body
    )
    return res.json(measurement)
  } catch (err) {
    return handleError(res, err)
  }
}

export const deleteMeasurement = async (req: AuthRequest, res: Response) => {
  try {
    await bodyMeasurementsService.deleteMeasurement(req.user!.userId, req.params.id)
    return res.status(204).send()
  } catch (err) {
    return handleError(res, err)
  }
}
