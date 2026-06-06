import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import {
  listPlans,
  getActivePlan,
  generateAndSavePlan,
  activatePlan,
  deletePlan,
} from '../controllers/plans.controller'

const router = Router()

router.use(authMiddleware)

router.get('/', listPlans)
router.get('/active', getActivePlan)
router.post('/generate', generateAndSavePlan)
router.post('/:id/activate', activatePlan)
router.delete('/:id', deletePlan)

export default router
