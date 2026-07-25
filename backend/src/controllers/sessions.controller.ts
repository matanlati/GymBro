import { Response } from 'express'
import { AuthRequest } from '../types'
import * as sessionsService from '../services/sessions.service'

const handleError = (res: Response, err: unknown) => {
  const message = err instanceof Error ? err.message : 'Failed to process session request'
  switch (message) {
    case 'NO_ACTIVE_PLAN':
      return res.status(404).json({ error: 'NO_ACTIVE_PLAN', message: 'No active plan to start a session from' })
    case 'SESSION_NOT_FOUND':
      return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Session not found' })
    case 'FORBIDDEN':
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You do not own this session' })
    case 'INVALID_DAY_INDEX':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'dayIndex is out of range for the active plan' })
    case 'INVALID_SCHEDULED_DATE':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'scheduledDate must be a valid date' })
    case 'SCHEDULED_DATE_NOT_FUTURE':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'scheduledDate cannot be in the past' })
    case 'INVALID_SCHEDULE_TITLE':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'title is required for custom workouts' })
    case 'INVALID_EXERCISE_INDEX':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'exerciseIndex is out of range' })
    case 'INVALID_SET_INDEX':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'setIndex is out of range' })
    case 'INVALID_SET_PAYLOAD':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'repsCompleted must be a non-negative number' })
    default:
      console.error('Sessions controller error:', err)
      return res.status(500).json({ error: 'INTERNAL_ERROR', message })
  }
}

// Parse a route param into an integer, or null if it isn't one.
const parseIndex = (raw: string): number | null => {
  const n = Number(raw)
  return Number.isInteger(n) ? n : null
}

export const listSessions = async (req: AuthRequest, res: Response) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined
    const sessions = await sessionsService.listSessions(req.user!.userId, date)
    return res.json(sessions)
  } catch (err) {
    return handleError(res, err)
  }
}

export const getTodaySession = async (req: AuthRequest, res: Response) => {
  try {
    const dayIndex = req.query.dayIndex !== undefined ? Number(req.query.dayIndex) : undefined
    const session = await sessionsService.getTodaySession(req.user!.userId, dayIndex)
    return res.json(session)
  } catch (err) {
    return handleError(res, err)
  }
}

export const createTodaySession = async (req: AuthRequest, res: Response) => {
  try {
    const dayIndex = req.body?.dayIndex !== undefined ? Number(req.body.dayIndex) : undefined
    const session = await sessionsService.getOrCreateTodaySession(req.user!.userId, dayIndex)
    return res.status(201).json(session)
  } catch (err) {
    return handleError(res, err)
  }
}

export const scheduleSession = async (req: AuthRequest, res: Response) => {
  try {
    const session = await sessionsService.scheduleSession(req.user!.userId, {
      scheduledDate: req.body?.scheduledDate,
      dayIndex: req.body?.dayIndex !== undefined ? Number(req.body.dayIndex) : undefined,
      title: req.body?.title,
    })
    return res.status(201).json(session)
  } catch (err) {
    return handleError(res, err)
  }
}

export const getSession = async (req: AuthRequest, res: Response) => {
  try {
    const session = await sessionsService.getSession(req.user!.userId, req.params.id)
    return res.json(session)
  } catch (err) {
    return handleError(res, err)
  }
}

export const startSession = async (req: AuthRequest, res: Response) => {
  try {
    const session = await sessionsService.startSession(req.user!.userId, req.params.id)
    return res.json(session)
  } catch (err) {
    return handleError(res, err)
  }
}

export const completeSession = async (req: AuthRequest, res: Response) => {
  try {
    const result = await sessionsService.completeSession(req.user!.userId, req.params.id)
    return res.json(result)
  } catch (err) {
    return handleError(res, err)
  }
}

export const logSet = async (req: AuthRequest, res: Response) => {
  const exerciseIndex = parseIndex(req.params.exerciseIndex)
  if (exerciseIndex === null) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'exerciseIndex must be an integer' })
  }
  try {
    const session = await sessionsService.logSet(
      req.user!.userId,
      req.params.sessionId,
      exerciseIndex,
      { repsCompleted: Number(req.body?.repsCompleted), weightUsedKg: req.body?.weightUsedKg }
    )
    return res.status(201).json(session)
  } catch (err) {
    return handleError(res, err)
  }
}

export const updateSet = async (req: AuthRequest, res: Response) => {
  const exerciseIndex = parseIndex(req.params.exerciseIndex)
  const setIndex = parseIndex(req.params.setIndex)
  if (exerciseIndex === null || setIndex === null) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'exerciseIndex and setIndex must be integers' })
  }
  try {
    const session = await sessionsService.updateSet(
      req.user!.userId,
      req.params.sessionId,
      exerciseIndex,
      setIndex,
      {
        repsCompleted: req.body?.repsCompleted !== undefined ? Number(req.body.repsCompleted) : undefined,
        weightUsedKg: req.body?.weightUsedKg,
      }
    )
    return res.json(session)
  } catch (err) {
    return handleError(res, err)
  }
}

export const deleteSet = async (req: AuthRequest, res: Response) => {
  const exerciseIndex = parseIndex(req.params.exerciseIndex)
  const setIndex = parseIndex(req.params.setIndex)
  if (exerciseIndex === null || setIndex === null) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'exerciseIndex and setIndex must be integers' })
  }
  try {
    const session = await sessionsService.deleteSet(
      req.user!.userId,
      req.params.sessionId,
      exerciseIndex,
      setIndex
    )
    return res.json(session)
  } catch (err) {
    return handleError(res, err)
  }
}
