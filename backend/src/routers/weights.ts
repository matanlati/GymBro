import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { createWeight, listWeights } from '../controllers/weights.controller'

const router = Router()

router.use(authMiddleware)

router.get('/', listWeights)
router.post('/', createWeight)

export default router
