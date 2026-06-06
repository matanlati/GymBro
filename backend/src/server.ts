import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import { connectDB } from './db/connection'
import authRouter from './routers/auth.router'
import { errorHandler } from './middleware/errorHandler'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const videoRouter = require('./routers/video')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const workoutPlanRouter = require('./routers/workoutPlan')

const app = express()
const PORT = process.env.PORT || 3001
const upload = multer({ dest: 'uploads/' })

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.use('/api/video', upload.single('video'), videoRouter)
app.use('/api/workout-plan', workoutPlanRouter)
app.use('/api/auth', authRouter)

app.use(errorHandler)

console.log('[env] GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✓ loaded' : '✗ MISSING')
console.log('[env] JWT_SECRET:', process.env.JWT_SECRET ? '✓ loaded' : '✗ MISSING')
console.log('[env] MONGODB_URI:', process.env.MONGODB_URI ? '✓ loaded' : '✗ MISSING')

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  })
  .catch((err: Error) => {
    console.error('Failed to connect to MongoDB:', err.message)
    process.exit(1)
  })
