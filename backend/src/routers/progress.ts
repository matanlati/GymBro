import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { getSummary, getExerciseSeries, getHistory } from '../controllers/progress.controller'
import {
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
} from '../controllers/progressGoals.controller'
import {
  listMeasurements,
  createMeasurement,
  updateMeasurement,
  deleteMeasurement,
} from '../controllers/bodyMeasurements.controller'
import { listAchievements } from '../controllers/achievements.controller'

const router = Router()

router.use(authMiddleware)

router.get('/summary', getSummary)
router.get('/history', getHistory)
router.get('/goals', listGoals)
router.post('/goals', createGoal)
router.patch('/goals/:id', updateGoal)
router.delete('/goals/:id', deleteGoal)
router.get('/measurements', listMeasurements)
router.post('/measurements', createMeasurement)
router.patch('/measurements/:id', updateMeasurement)
router.delete('/measurements/:id', deleteMeasurement)
router.get('/achievements', listAchievements)
router.get('/exercise/:name', getExerciseSeries)

export default router
