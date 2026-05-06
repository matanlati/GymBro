const express = require('express')
const router = express.Router()
const videoController = require('../controllers/videoController')

router.post('/analyze', videoController.analyzeVideo)

module.exports = router