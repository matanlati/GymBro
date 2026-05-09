const fs = require('fs')
const http = require('http')
const https = require('https')
const { randomUUID } = require('crypto')
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

  getTimeoutMs() {
    const timeoutMs = Number(process.env.VIDEO_ANALYSIS_TIMEOUT_MS || 15 * 60 * 1000)
    return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15 * 60 * 1000
  }

  buildMultipartBody(videoFile, fileBuffer) {
    const boundary = `----gymbro-video-analysis-${randomUUID()}`
    const chunks = []

    chunks.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="video"; filename="${this.escapeHeaderValue(videoFile.originalname || 'video')}"\r\n` +
      `Content-Type: ${videoFile.mimetype || 'application/octet-stream'}\r\n\r\n`
    ))
    chunks.push(fileBuffer)
    chunks.push(Buffer.from('\r\n'))

    if (videoFile.exerciseType) {
      chunks.push(Buffer.from(
        `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="exerciseType"\r\n\r\n' +
        `${videoFile.exerciseType}\r\n`
      ))
    }

    chunks.push(Buffer.from(`--${boundary}--\r\n`))

    return {
      boundary,
      body: Buffer.concat(chunks)
    }
  }

  escapeHeaderValue(value) {
    return String(value).replace(/["\r\n]/g, '_')
  }

  requestAnalysis(serviceUrl, headers, body, timeoutMs) {
    return new Promise((resolve, reject) => {
      const url = new URL(serviceUrl)
      const client = url.protocol === 'https:' ? https : http

      const req = client.request({
        method: 'POST',
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        headers,
        timeout: timeoutMs
      }, (res) => {
        const chunks = []

        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: Buffer.concat(chunks).toString('utf8')
          })
        })
      })

      req.on('timeout', () => {
        req.destroy(new Error(`Video analysis service timed out after ${timeoutMs}ms`))
      })
      req.on('error', reject)
      req.end(body)
    })
  }

  async analyze(videoFile) {
    const serviceUrl = this.getServiceUrl()
    const apiKey = this.getApiKey()
    const timeoutMs = this.getTimeoutMs()
    const fileBuffer = await fs.promises.readFile(videoFile.path)
    const { boundary, body } = this.buildMultipartBody(videoFile, fileBuffer)

    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length
    }
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
    }

    const response = await this.requestAnalysis(serviceUrl, headers, body, timeoutMs)

    const text = response.text
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
