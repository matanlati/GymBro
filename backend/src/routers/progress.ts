import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { getSummary, getExerciseSeries, getHistory } from '../controllers/progress.controller'

const router = Router()

router.use(authMiddleware)

router.get('/summary', getSummary)
router.get('/history', getHistory)
router.get('/exercise/:name', getExerciseSeries)

export default router
