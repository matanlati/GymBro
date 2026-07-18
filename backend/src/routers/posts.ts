import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { authMiddleware } from '../middleware/auth'
import { createPost, listPosts } from '../controllers/posts.controller'

const router = Router()
const uploadDir = path.resolve(process.cwd(), 'uploads', 'feed')
fs.mkdirSync(uploadDir, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`)
    },
  }),
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'))
  },
  limits: { fileSize: 5 * 1024 * 1024 },
})

router.use(authMiddleware)

router.get('/', listPosts)
router.post('/', upload.single('photo'), createPost)

export default router
