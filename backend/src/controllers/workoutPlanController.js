const WorkoutPlanService = require('../services/workoutPlan/WorkoutPlanService')

const workoutPlanController = {
  generateWorkoutPlan: async (req, res) => {
    try {
      const questionnaireData = req.body
      const workoutPlan = await WorkoutPlanService.generatePlan(questionnaireData)
      res.json(workoutPlan)
    } catch (error) {
      console.error('Workout plan generation error:', error)
      res.status(500).json({ error: error.message || 'Failed to generate workout plan' })
    }
  }
}

module.exports = workoutPlanController