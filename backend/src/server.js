const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), override: true })
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const videoRoutes = require('./routes/video')
const workoutPlanRoutes = require('./routes/workoutPlan')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Multer for file uploads
const upload = multer({ dest: 'uploads/' })

app.use('/api/video', upload.single('video'), videoRoutes)
app.use('/api/workout-plan', workoutPlanRoutes)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
