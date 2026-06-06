import { Router } from 'express'
import multer from 'multer'
import { authMiddleware } from '../middleware/auth'
import { getMe, updateMe, uploadPhoto } from '../controllers/users.controller'

const router = Router()
const upload = multer({
  dest: 'uploads/tmp/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'))
  },
})

router.use(authMiddleware)

router.get('/me', getMe)
router.put('/me', updateMe)
router.post('/me/photo', upload.single('photo'), uploadPhoto)

export default router
