import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import {
  acceptInvite,
  clearCoachProgressLookout,
  createTraineeProgressGoal,
  createCoachTraineeWorkoutType,
  deleteTraineeProgressGoal,
  getCoachAlertSettings,
  getCoachDashboardSummary,
  getCoachProgressLookout,
  getCoachTraineeNotes,
  getCoachTraineeWorkouts,
  getProgressOverview,
  getTraineeProgress,
  getTraineeProgressAchievements,
  getTraineeProgressExercise,
  getTraineeProgressGoals,
  getTraineeProgressMeasurements,
  listCoachInvites,
  listCoachTodayWorkouts,
  listCoachTrainees,
  listMyInvites,
  removeCoachTrainee,
  reviewCoachWorkout,
  saveCoachTraineeNotes,
  sendInvite,
  updateCoachAlertSettings,
  updateCoachTraineeWorkoutType,
  updateTraineeProgressGoal,
} from '../controllers/coach.controller'

const router = Router()

router.use(authMiddleware)

router.get('/progress/overview', getProgressOverview)
router.get('/trainees/:id/progress/summary', getTraineeProgress)
router.get('/trainees/:id/progress/goals', getTraineeProgressGoals)
router.post('/trainees/:id/progress/goals', createTraineeProgressGoal)
router.patch('/trainees/:id/progress/goals/:goalId', updateTraineeProgressGoal)
router.delete('/trainees/:id/progress/goals/:goalId', deleteTraineeProgressGoal)
router.get('/trainees/:id/progress/achievements', getTraineeProgressAchievements)
router.get('/trainees/:id/progress/measurements', getTraineeProgressMeasurements)
router.get('/trainees/:id/progress/exercise/:name', getTraineeProgressExercise)
router.post('/invites', sendInvite)
router.get('/invites', listCoachInvites)
router.get('/trainees', listCoachTrainees)
router.get('/trainees/:id/workouts', getCoachTraineeWorkouts)
router.post('/trainees/:id/workout-types', createCoachTraineeWorkoutType)
router.put('/trainees/:id/workout-types/:dayIndex', updateCoachTraineeWorkoutType)
router.get('/dashboard-summary', getCoachDashboardSummary)
router.get('/settings', getCoachAlertSettings)
router.put('/settings', updateCoachAlertSettings)
router.get('/today-workouts', listCoachTodayWorkouts)
router.get('/progress-lookout', getCoachProgressLookout)
router.post('/progress-lookout/:traineeId/clear', clearCoachProgressLookout)
router.post('/workout-reviews/:sessionId', reviewCoachWorkout)
router.get('/trainees/:id/notes', getCoachTraineeNotes)
router.put('/trainees/:id/notes', saveCoachTraineeNotes)
router.delete('/trainees/:id', removeCoachTrainee)
router.get('/my-invites', listMyInvites)
router.post('/invites/:id/accept', acceptInvite)

export default router
