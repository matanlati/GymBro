import fs from 'fs'
import http from 'http'
import https from 'https'
import { randomUUID } from 'crypto'
import { IVideoAnalysisService } from './IVideoAnalysisService'
import { VideoFile } from '../../types'

interface RequestResponse {
  ok: boolean
  status: number
  text: string
}

class VideoAnalysisApiAdapter extends IVideoAnalysisService {
  private getServiceUrl(): string {
    const serviceUrl = process.env.VIDEO_ANALYSIS_SERVICE_URL
    if (!serviceUrl) throw new Error('VIDEO_ANALYSIS_SERVICE_URL environment variable is required')
    return serviceUrl
  }

  private getApiKey(): string | null {
    return process.env.VIDEO_ANALYSIS_API_KEY || null
  }

  private getTimeoutMs(): number {
    const timeoutMs = Number(process.env.VIDEO_ANALYSIS_TIMEOUT_MS || 15 * 60 * 1000)
    return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15 * 60 * 1000
  }

  private escapeHeaderValue(value: string): string {
    return String(value).replace(/["\r\n]/g, '_')
  }

  private buildMultipartBody(videoFile: VideoFile, fileBuffer: Buffer): { boundary: string; body: Buffer } {
    const boundary = `----gymbro-video-analysis-${randomUUID()}`
    const chunks: Buffer[] = []

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
    return { boundary, body: Buffer.concat(chunks) }
  }

  private requestAnalysis(
    serviceUrl: string,
    headers: Record<string, string | number>,
    body: Buffer,
    timeoutMs: number
  ): Promise<RequestResponse> {
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
        timeout: timeoutMs,
      }, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
            status: res.statusCode ?? 0,
            text: Buffer.concat(chunks).toString('utf8'),
          })
        })
      })

      req.on('timeout', () => req.destroy(new Error(`Video analysis service timed out after ${timeoutMs}ms`)))
      req.on('error', reject)
      req.end(body)
    })
  }

  async analyze(videoFile: VideoFile): Promise<unknown> {
    const serviceUrl = this.getServiceUrl()
    const apiKey = this.getApiKey()
    const timeoutMs = this.getTimeoutMs()
    const fileBuffer = await fs.promises.readFile(videoFile.path)
    const { boundary, body } = this.buildMultipartBody(videoFile, fileBuffer)

    const headers: Record<string, string | number> = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const response = await this.requestAnalysis(serviceUrl, headers, body, timeoutMs)

    let data: Record<string, unknown>
    try {
      data = JSON.parse(response.text)
    } catch {
      throw new Error(`Video analysis service returned invalid JSON: ${response.text}`)
    }

    if (!response.ok) {
      const errData = data.error as Record<string, unknown> | undefined
      const message = (errData?.message as string) || response.text || `Status ${response.status}`
      throw new Error(`Video analysis service error: ${message}`)
    }

    return data
  }
}

export default new VideoAnalysisApiAdapter()
