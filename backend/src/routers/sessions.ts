import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import {
  listSessions,
  getTodaySession,
  createTodaySession,
  getSession,
  completeSession,
  logSet,
  updateSet,
  deleteSet,
} from '../controllers/sessions.controller'

const router = Router()

router.use(authMiddleware)

router.get('/', listSessions)
// GET returns today's existing session (or 404); POST creates-or-returns it.
router.get('/today', getTodaySession)
router.post('/today', createTodaySession)
router.get('/:id', getSession)
router.post('/:id/complete', completeSession)
router.post('/:sessionId/exercises/:exerciseIndex/sets', logSet)
router.put('/:sessionId/exercises/:exerciseIndex/sets/:setIndex', updateSet)
router.delete('/:sessionId/exercises/:exerciseIndex/sets/:setIndex', deleteSet)

export default router
