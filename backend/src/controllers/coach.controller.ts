import { Response } from 'express'
import { AuthRequest } from '../types'
import * as coachService from '../services/coach.service'

const handleCoachError = (res: Response, err: unknown) => {
  const message = err instanceof Error ? err.message : 'Coach request failed'
  switch (message) {
    case 'COACH_ONLY':
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only coaches can do this' })
    case 'TRAINEE_ONLY':
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only trainees can do this' })
    case 'INVALID_EMAIL':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Trainee email is required' })
    case 'INVALID_INVITE':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invite id is invalid' })
    case 'INVALID_TRAINEE':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Trainee id is invalid' })
    case 'INVALID_NOTES':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Notes must be 5,000 characters or fewer' })
    case 'INVALID_INACTIVITY_DAYS':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'inactiveDays must be between 1 and 90' })
    case 'INVALID_SESSION':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Session id is invalid' })
    case 'WORKOUT_NOT_FOUND':
      return res.status(404).json({ error: 'WORKOUT_NOT_FOUND', message: 'Completed trainee workout not found' })
    case 'TRAINEE_NOT_FOUND':
      return res.status(404).json({ error: 'TRAINEE_NOT_FOUND', message: 'No trainee account was found with that email' })
    case 'COACH_TRAINEE_NOT_FOUND':
      return res.status(404).json({ error: 'TRAINEE_NOT_FOUND', message: 'This trainee is not assigned to you' })
    case 'TARGET_NOT_TRAINEE':
      return res.status(400).json({ error: 'TARGET_NOT_TRAINEE', message: 'That email does not belong to a trainee account' })
    case 'TRAINEE_ALREADY_HAS_COACH':
      return res.status(400).json({ error: 'TRAINEE_ALREADY_HAS_COACH', message: 'This trainee already has a coach' })
    case 'INVITE_NOT_FOUND':
      return res.status(404).json({ error: 'INVITE_NOT_FOUND', message: 'Invite not found' })
    case 'USER_NOT_FOUND':
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' })
    default:
      console.error('Coach controller error:', err)
      return res.status(500).json({ error: 'INTERNAL_ERROR', message })
  }
}

export async function sendInvite(req: AuthRequest, res: Response) {
  try {
    const invite = await coachService.sendInvite(req.user!.userId, req.body?.email)
    return res.status(201).json(invite)
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function listCoachInvites(req: AuthRequest, res: Response) {
  try {
    const invites = await coachService.listCoachInvites(req.user!.userId)
    return res.json(invites)
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function listCoachTrainees(req: AuthRequest, res: Response) {
  try {
    const trainees = await coachService.listCoachTrainees(req.user!.userId)
    return res.json(trainees)
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function getCoachDashboardSummary(req: AuthRequest, res: Response) {
  try {
    const inactiveDays = req.query.inactiveDays === undefined
      ? 7
      : Number(req.query.inactiveDays)
    const summary = await coachService.getDashboardSummary(req.user!.userId, inactiveDays)
    return res.json(summary)
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function listCoachTodayWorkouts(req: AuthRequest, res: Response) {
  try {
    const workouts = await coachService.listTodayWorkouts(req.user!.userId)
    return res.json(workouts)
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function reviewCoachWorkout(req: AuthRequest, res: Response) {
  try {
    const review = await coachService.reviewWorkout(req.user!.userId, req.params.sessionId)
    return res.json(review)
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function removeCoachTrainee(req: AuthRequest, res: Response) {
  try {
    await coachService.removeTrainee(req.user!.userId, req.params.id)
    return res.status(204).send()
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function getCoachTraineeNotes(req: AuthRequest, res: Response) {
  try {
    const notes = await coachService.getTraineeNotes(req.user!.userId, req.params.id)
    return res.json(notes)
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function saveCoachTraineeNotes(req: AuthRequest, res: Response) {
  try {
    const notes = await coachService.saveTraineeNotes(req.user!.userId, req.params.id, req.body?.notes)
    return res.json(notes)
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function listMyInvites(req: AuthRequest, res: Response) {
  try {
    const invites = await coachService.listMyInvites(req.user!.userId)
    return res.json(invites)
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function acceptInvite(req: AuthRequest, res: Response) {
  try {
    const invite = await coachService.acceptInvite(req.user!.userId, req.params.id)
    return res.json(invite)
  } catch (err) {
    return handleCoachError(res, err)
  }
}
