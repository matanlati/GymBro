const fs = require('fs')
const path = require('path')
const IVideoAnalysisService = require('./IVideoAnalysisService')

class VideoAnalysisApiAdapter extends IVideoAnalysisService {
  getServiceUrl() {
    const serviceUrl = process.env.VIDEO_ANALYSIS_SERVICE_URL
    if (!serviceUrl) {
      throw new Error('VIDEO_ANALYSIS_SERVICE_URL environment variable is required for the real video analysis service')
    }
    return serviceUrl
  }

  getApiKey() {
    return process.env.VIDEO_ANALYSIS_API_KEY || null
  }

  async analyze(videoFile) {
    const serviceUrl = this.getServiceUrl()
    const apiKey = this.getApiKey()

    const FormData = global.FormData || require('form-data')
    const formData = new FormData()
    const fileStream = fs.createReadStream(videoFile.path)
    formData.append('video', fileStream, videoFile.originalname)

    const headers = {}
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
    }

    if (typeof formData.getHeaders === 'function') {
      Object.assign(headers, formData.getHeaders())
    }

    const response = await fetch(serviceUrl, {
      method: 'POST',
      headers,
      body: formData
    })

    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch (parseError) {
      throw new Error(`Video analysis service returned invalid JSON: ${text}`)
    }

    if (!response.ok) {
      const message = data.error?.message || text || `Status ${response.status}`
      throw new Error(`Video analysis service error: ${message}`)
    }

    return data
  }
}

module.exports = new VideoAnalysisApiAdapter()
