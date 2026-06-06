import { Router } from 'express'
import { analyzeVideo } from '../controllers/videoController'

const router = Router()

router.post('/analyze', analyzeVideo)

export default router
