import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { acceptInvite, clearCoachProgressLookout, getCoachAlertSettings, getCoachDashboardSummary, getCoachProgressLookout, getCoachTraineeNotes, listCoachInvites, listCoachTodayWorkouts, listCoachTrainees, listMyInvites, removeCoachTrainee, reviewCoachWorkout, saveCoachTraineeNotes, sendInvite, updateCoachAlertSettings } from '../controllers/coach.controller'

const router = Router()

router.use(authMiddleware)

router.post('/invites', sendInvite)
router.get('/invites', listCoachInvites)
router.get('/trainees', listCoachTrainees)
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
