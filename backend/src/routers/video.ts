import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { analyzeVideo, listAnalyses } from '../controllers/videoController'

const router = Router()

router.use(authMiddleware)

router.post('/analyze', analyzeVideo)
router.get('/analyses', listAnalyses)

export default router
