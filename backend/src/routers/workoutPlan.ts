import { Router } from 'express'
import { generateWorkoutPlan } from '../controllers/workoutPlanController'

const router = Router()

router.post('/generate', generateWorkoutPlan)

export default router
