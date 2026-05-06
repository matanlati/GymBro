const express = require('express')
const router = express.Router()
const workoutPlanController = require('../controllers/workoutPlanController')

router.post('/generate', workoutPlanController.generateWorkoutPlan)

module.exports = router