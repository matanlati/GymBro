import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { acceptInvite, listCoachInvites, listCoachTrainees, listMyInvites, sendInvite } from '../controllers/coach.controller'

const router = Router()

router.use(authMiddleware)

router.post('/invites', sendInvite)
router.get('/invites', listCoachInvites)
router.get('/trainees', listCoachTrainees)
router.get('/my-invites', listMyInvites)
router.post('/invites/:id/accept', acceptInvite)

export default router
