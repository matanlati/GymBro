import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'
import { AddressInfo } from 'net'
import VideoAnalysisApiAdapter from '../src/services/videoAnalysis/VideoAnalysisApiAdapter'
import { VideoFile } from '../src/types'

// Round-trips against a real local HTTP server so the hand-built multipart body
// is checked as it goes over the wire -- this is the contract with the FastAPI
// endpoint (file, exercise_type, side, output_filename).
let server: http.Server
let received: string
let responseBody = '{}'
let statusCode = 200

const makeVideoFile = (over: Partial<VideoFile> = {}): VideoFile => {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gymbro-adapter-')), 'clip.mp4')
  fs.writeFileSync(filePath, 'fake video bytes')
  return {
    path: filePath,
    originalname: 'clip.mp4',
    mimetype: 'video/mp4',
    exerciseType: 'squat',
    side: 'right',
    ...over,
  } as VideoFile
}

beforeAll((done) => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      received = Buffer.concat(chunks).toString('utf8')
      res.writeHead(statusCode, { 'Content-Type': 'application/json' })
      res.end(responseBody)
    })
  })
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address() as AddressInfo
    process.env.VIDEO_ANALYSIS_SERVICE_URL = `http://127.0.0.1:${port}/analyze/upload`
    done()
  })
})

afterAll((done) => {
  server.close(done)
})

beforeEach(() => {
  responseBody = JSON.stringify({ exerciseType: 'squat', score: 80 })
  statusCode = 200
})

describe('VideoAnalysisApiAdapter.analyze', () => {
  it('sends the file plus exercise_type, side and output_filename', async () => {
    const videoFile = makeVideoFile({ outputFilename: 'hash1_squat_right.mp4' })

    await VideoAnalysisApiAdapter.analyze(videoFile)

    expect(received).toContain('name="file"; filename="clip.mp4"')
    expect(received).toContain('fake video bytes')
    expect(received).toContain('name="exercise_type"\r\n\r\nsquat')
    expect(received).toContain('name="side"\r\n\r\nright')
    expect(received).toContain('name="output_filename"\r\n\r\nhash1_squat_right.mp4')
  })

  it('omits output_filename when the controller did not derive one', async () => {
    await VideoAnalysisApiAdapter.analyze(makeVideoFile())
    expect(received).not.toContain('output_filename')
  })

  it('returns the parsed service payload', async () => {
    const result = await VideoAnalysisApiAdapter.analyze(makeVideoFile())
    expect(result).toEqual({ exerciseType: 'squat', score: 80 })
  })

  it('throws with the service message on a non-2xx response', async () => {
    statusCode = 422
    responseBody = JSON.stringify({ error: { message: 'Invalid output_filename' } })
    await expect(VideoAnalysisApiAdapter.analyze(makeVideoFile())).rejects.toThrow(
      'Invalid output_filename'
    )
  })
})
