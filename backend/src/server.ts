import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import { connectDB } from './db/connection'
import authRouter from './routers/auth.router'
import usersRouter from './routers/users.router'
import videoRouter from './routers/video'
import workoutPlanRouter from './routers/workoutPlan'
import plansRouter from './routers/plans'
import sessionsRouter from './routers/sessions'
import progressRouter from './routers/progress'
import { errorHandler } from './middleware/errorHandler'

const app = express()
const PORT = process.env.PORT || 3001
const upload = multer({ dest: 'uploads/' })

console.log('[env] GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✓ loaded' : '✗ MISSING')
console.log('[env] JWT_SECRET:', process.env.JWT_SECRET ? '✓ loaded' : '✗ MISSING')
console.log('[env] MONGODB_URI:', process.env.MONGODB_URI ? '✓ loaded' : '✗ MISSING')

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use('/uploads', express.static('uploads'))

app.use('/api/video', upload.single('video'), videoRouter)
app.use('/api/workout-plan', workoutPlanRouter)
app.use('/api/plans', plansRouter)
app.use('/api/sessions', sessionsRouter)
app.use('/api/progress', progressRouter)
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)

// ── Serve the built frontend (production) ────────────────────────────────────
// The build script copies frontend/dist into backend/dist/public. When that
// folder exists, serve it and fall back to index.html for client-side routes.
// The /api guard keeps unknown API paths returning JSON 404s, not index.html.
const clientDir = path.join(__dirname, 'public')
if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir))
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'))
  })
} else {
  console.log('[static] no frontend build found at', clientDir, '(API-only mode)')
}

app.use(errorHandler)

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  })
  .catch((err: Error) => {
    console.error('Failed to connect to MongoDB:', err.message)
    process.exit(1)
  })
