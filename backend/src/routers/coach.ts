import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { acceptInvite, getCoachTraineeNotes, listCoachInvites, listCoachTrainees, listMyInvites, removeCoachTrainee, saveCoachTraineeNotes, sendInvite } from '../controllers/coach.controller'

const router = Router()

router.use(authMiddleware)

router.post('/invites', sendInvite)
router.get('/invites', listCoachInvites)
router.get('/trainees', listCoachTrainees)
router.get('/trainees/:id/notes', getCoachTraineeNotes)
router.put('/trainees/:id/notes', saveCoachTraineeNotes)
router.delete('/trainees/:id', removeCoachTrainee)
router.get('/my-invites', listMyInvites)
router.post('/invites/:id/accept', acceptInvite)

export default router
