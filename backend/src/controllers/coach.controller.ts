import { Response } from 'express'
import { AuthRequest } from '../types'
import * as coachService from '../services/coach.service'
import {
  createTraineeGoal,
  deleteTraineeGoal,
  getCoachProgressOverview,
  getTraineeExerciseSeries,
  getTraineeProgressSummary,
  listTraineeAchievements,
  listTraineeGoals,
  listTraineeMeasurements,
  updateTraineeGoal,
} from '../services/coachProgress.service'
import { AchievementCategory } from '../models/AchievementUnlock.model'
import { ProgressGoalStatus } from '../models/ProgressGoal.model'

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
    case 'INVALID_PERIOD':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Period must be week, month, quarter, or year' })
    case 'INVALID_GOAL_STATUS':
    case 'INVALID_GOAL_PAYLOAD':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid goal data' })
    case 'INVALID_ACHIEVEMENT_FILTERS':
    case 'INVALID_MEASUREMENT_FILTERS':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid progress filters' })
    case 'GOAL_NOT_FOUND':
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Goal not found' })
    case 'INVALID_INACTIVITY_DAYS':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'inactiveDays must be between 1 and 90' })
    case 'INVALID_STAGNANT_WORKOUTS':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Stagnant workouts must be between 2 and 10' })
    case 'INVALID_SESSION':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Session id is invalid' })
    case 'WORKOUT_NOT_FOUND':
      return res.status(404).json({ error: 'WORKOUT_NOT_FOUND', message: 'Completed trainee workout not found' })
    case 'INVALID_WORKOUT_KEY':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'A valid workout key is required' })
    case 'TRAINEE_NOT_FOUND':
      return res.status(404).json({ error: 'TRAINEE_NOT_FOUND', message: 'No trainee account was found with that email' })
    case 'COACH_TRAINEE_NOT_FOUND':
      return res.status(404).json({ error: 'TRAINEE_NOT_FOUND', message: 'This trainee is not assigned to you' })
    case 'TARGET_NOT_TRAINEE':
      return res.status(400).json({ error: 'TARGET_NOT_TRAINEE', message: 'That email does not belong to a trainee account' })
    case 'TRAINEE_ALREADY_HAS_COACH':
      return res.status(400).json({ error: 'TRAINEE_ALREADY_HAS_COACH', message: 'This trainee already has a coach' })
    case 'COACH_CAPACITY_REACHED':
      return res.status(409).json({ error: 'COACH_CAPACITY_REACHED', message: 'You have reached your trainee capacity. Increase it in your profile before inviting another trainee.' })
    case 'INVITE_NOT_FOUND':
      return res.status(404).json({ error: 'INVITE_NOT_FOUND', message: 'Invite not found' })
    case 'USER_NOT_FOUND':
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' })
    default:
      console.error('Coach controller error:', err)
      return res.status(500).json({ error: 'INTERNAL_ERROR', message })
  }
}

export async function getProgressOverview(req: AuthRequest, res: Response) {
  try {
    const period = typeof req.query.period === 'string' ? req.query.period : 'month'
    const overview = await getCoachProgressOverview(req.user!.userId, period)
    return res.json(overview)
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function getTraineeProgress(req: AuthRequest, res: Response) {
  try {
    const summary = await getTraineeProgressSummary(req.user!.userId, req.params.id)
    return res.json(summary)
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function getTraineeProgressExercise(req: AuthRequest, res: Response) {
  const name = req.params.name?.trim()
  if (!name) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'exercise name is required' })
  }
  try {
    const series = await getTraineeExerciseSeries(req.user!.userId, req.params.id, name)
    return res.json(series)
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function getTraineeProgressGoals(req: AuthRequest, res: Response) {
  try {
    const status = typeof req.query.status === 'string'
      ? req.query.status as ProgressGoalStatus
      : undefined
    const goals = await listTraineeGoals(req.user!.userId, req.params.id, status)
    return res.json(goals)
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function createTraineeProgressGoal(req: AuthRequest, res: Response) {
  try {
    const goal = await createTraineeGoal(req.user!.userId, req.params.id, req.body)
    return res.status(201).json(goal)
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function updateTraineeProgressGoal(req: AuthRequest, res: Response) {
  try {
    const goal = await updateTraineeGoal(
      req.user!.userId,
      req.params.id,
      req.params.goalId,
      req.body
    )
    return res.json(goal)
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function deleteTraineeProgressGoal(req: AuthRequest, res: Response) {
  try {
    await deleteTraineeGoal(req.user!.userId, req.params.id, req.params.goalId)
    return res.status(204).send()
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function getTraineeProgressAchievements(req: AuthRequest, res: Response) {
  try {
    const category = typeof req.query.category === 'string'
      ? req.query.category as AchievementCategory
      : undefined
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined
    const achievements = await listTraineeAchievements(
      req.user!.userId,
      req.params.id,
      category,
      limit
    )
    return res.json(achievements)
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function getTraineeProgressMeasurements(req: AuthRequest, res: Response) {
  try {
    const measurements = await listTraineeMeasurements(req.user!.userId, req.params.id, {
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
    })
    return res.json(measurements)
  } catch (err) {
    return handleCoachError(res, err)
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
    const summary = await coachService.getDashboardSummary(req.user!.userId)
    return res.json(summary)
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function getCoachAlertSettings(req: AuthRequest, res: Response) {
  try {
    return res.json(await coachService.getCoachSettings(req.user!.userId))
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function updateCoachAlertSettings(req: AuthRequest, res: Response) {
  try {
    return res.json(await coachService.updateCoachSettings(req.user!.userId, req.body ?? {}))
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

export async function getCoachProgressLookout(req: AuthRequest, res: Response) {
  try {
    const lookout = await coachService.getProgressLookout(req.user!.userId)
    return res.json(lookout)
  } catch (err) {
    return handleCoachError(res, err)
  }
}

export async function clearCoachProgressLookout(req: AuthRequest, res: Response) {
  try {
    const cleared = await coachService.clearProgressLookout(
      req.user!.userId,
      req.params.traineeId,
      req.body?.workoutKey
    )
    return res.json(cleared)
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
