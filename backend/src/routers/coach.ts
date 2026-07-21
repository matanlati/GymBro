import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { acceptInvite, getCoachTraineeNotes, getProgressOverview, listCoachInvites, listCoachTrainees, listMyInvites, removeCoachTrainee, saveCoachTraineeNotes, sendInvite } from '../controllers/coach.controller'

const router = Router()

router.use(authMiddleware)

router.get('/progress/overview', getProgressOverview)
router.post('/invites', sendInvite)
router.get('/invites', listCoachInvites)
router.get('/trainees', listCoachTrainees)
router.get('/trainees/:id/notes', getCoachTraineeNotes)
router.put('/trainees/:id/notes', saveCoachTraineeNotes)
router.delete('/trainees/:id', removeCoachTrainee)
router.get('/my-invites', listMyInvites)
router.post('/invites/:id/accept', acceptInvite)

export default router
