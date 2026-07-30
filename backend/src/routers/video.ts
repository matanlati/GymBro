import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { analyzeVideo, listAnalyses, streamVideo } from '../controllers/videoController'

const router = Router()

router.use(authMiddleware)

router.post('/analyze', analyzeVideo)
router.get('/analyses', listAnalyses)
router.get('/stream/:filename', streamVideo)

export default router
