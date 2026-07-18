import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { getSummary, getExerciseSeries, getHistory } from '../controllers/progress.controller'
import {
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
} from '../controllers/progressGoals.controller'

const router = Router()

router.use(authMiddleware)

router.get('/summary', getSummary)
router.get('/history', getHistory)
router.get('/goals', listGoals)
router.post('/goals', createGoal)
router.patch('/goals/:id', updateGoal)
router.delete('/goals/:id', deleteGoal)
router.get('/exercise/:name', getExerciseSeries)

export default router
