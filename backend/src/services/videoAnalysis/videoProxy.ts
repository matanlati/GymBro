import http from 'http'
import https from 'https'
import { Request, Response } from 'express'

// The pose-estimation microservice serves annotated videos at
// `<VIDEO_ANALYSIS_SERVICE_URL origin>/videos/<filename>`. That origin
// (e.g. http://localhost:8000) is only reachable from the backend, not the
// browser — so the backend proxies the file to the client.

const VIDEO_PATH_PREFIX = 'videos'

// Derive the microservice origin from the configured analyze URL.
// VIDEO_ANALYSIS_SERVICE_URL points at .../analyze/upload; we only want the origin.
function getServiceOrigin(): string {
  const serviceUrl = process.env.VIDEO_ANALYSIS_SERVICE_URL
  if (!serviceUrl) throw new Error('VIDEO_ANALYSIS_SERVICE_URL environment variable is required')
  const url = new URL(serviceUrl)
  return `${url.protocol}//${url.host}`
}

/**
 * Build the backend-facing URL the client should use to load an annotated
 * video, given the raw URL returned by the microservice
 * (e.g. http://localhost:8000/videos/abc.mp4 -> /api/video/stream/abc.mp4).
 * Returns the original value unchanged if it can't be parsed.
 */
export function toBackendVideoUrl(serviceVideoUrl: string | undefined): string | undefined {
  if (!serviceVideoUrl) return serviceVideoUrl
  try {
    const parsed = new URL(serviceVideoUrl)
    const filename = parsed.pathname.split('/').filter(Boolean).pop()
    if (!filename) return serviceVideoUrl
    return `/api/video/stream/${encodeURIComponent(filename)}`
  } catch {
    return serviceVideoUrl
  }
}

// Reject anything that isn't a bare filename, to prevent path traversal.
export function isSafeFilename(name: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(name) && !name.includes('..')
}

/**
 * Proxy a single annotated video from the microservice to the client,
 * forwarding Range requests so the browser <video> element can seek.
 */
export function streamVideoFromService(filename: string, req: Request, res: Response): void {
  const origin = getServiceOrigin()
  const target = new URL(`${origin}/${VIDEO_PATH_PREFIX}/${encodeURIComponent(filename)}`)
  const client = target.protocol === 'https:' ? https : http

  const headers: Record<string, string> = {}
  if (req.headers.range) headers['Range'] = req.headers.range

  const upstream = client.request(
    {
      method: 'GET',
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: target.pathname,
      headers,
    },
    (upstreamRes) => {
      // Mirror status (200 or 206) and the headers a media player needs.
      const status = upstreamRes.statusCode ?? 502
      const passthrough = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control']
      for (const key of passthrough) {
        const value = upstreamRes.headers[key]
        if (value) res.setHeader(key, value)
      }
      if (!upstreamRes.headers['content-type']) res.setHeader('Content-Type', 'video/mp4')
      res.status(status)
      upstreamRes.pipe(res)
    }
  )

  upstream.on('error', (err) => {
    console.error('Video proxy error:', err)
    if (!res.headersSent) {
      res.status(502).json({ error: 'BAD_GATEWAY', message: 'Failed to fetch analyzed video' })
    } else {
      res.end()
    }
  })

  // If the client disconnects, tear down the upstream request.
  req.on('close', () => upstream.destroy())
  upstream.end()
}
