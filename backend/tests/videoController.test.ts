delete process.env.VIDEO_ANALYSIS_SERVICE_URL // force the stub-adapter require path

jest.mock('fs', () => ({ unlink: jest.fn((_p: string, cb?: (e: unknown) => void) => cb && cb(null)) }))
jest.mock('../src/services/videoAnalysis/VideoAnalysisStubAdapter', () => ({
  __esModule: true,
  default: { analyze: jest.fn() },
}))
jest.mock('../src/services/videoAnalysis/PoseAnalysisService', () => ({
  __esModule: true,
  default: { saveAnalysis: jest.fn(), listRecent: jest.fn(), toRecentDto: jest.fn() },
}))
jest.mock('../src/services/videoAnalysis/AnalysisCacheService', () => ({
  __esModule: true,
  default: {
    hashFile: jest.fn(),
    buildKey: jest.fn(),
    outputFilename: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  },
}))

import fs from 'fs'
import { Response } from 'express'
import { analyzeVideo, listAnalyses } from '../src/controllers/videoController'
import StubAdapter from '../src/services/videoAnalysis/VideoAnalysisStubAdapter'
import PoseAnalysisService from '../src/services/videoAnalysis/PoseAnalysisService'
import AnalysisCacheService from '../src/services/videoAnalysis/AnalysisCacheService'
import { AuthRequest, Evaluation } from '../src/types'

const mockAnalyze = (StubAdapter as unknown as { analyze: jest.Mock }).analyze
const mockSave = PoseAnalysisService.saveAnalysis as jest.Mock
const mockList = PoseAnalysisService.listRecent as jest.Mock
const mockToDto = PoseAnalysisService.toRecentDto as jest.Mock
const mockHashFile = AnalysisCacheService.hashFile as jest.Mock
const mockBuildKey = AnalysisCacheService.buildKey as jest.Mock
const mockOutputFilename = AnalysisCacheService.outputFilename as jest.Mock
const mockCacheGet = AnalysisCacheService.get as jest.Mock
const mockCacheSet = AnalysisCacheService.set as jest.Mock

const evaluation: Evaluation = {
  exerciseType: 'push-up',
  score: 72,
  isGoodTechnique: true,
  scoreExplanation: 'why',
  overallSummary: 'summary',
  positiveFeedback: [],
  issues: [],
  recommendations: [],
}

const makeRes = () =>
  ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response)

const makeReq = (over: Partial<AuthRequest> = {}): AuthRequest =>
  ({
    user: { userId: 'user1', email: 'a@b.com' },
    file: { path: '/tmp/x.mp4', originalname: 'x.mp4' },
    body: { exerciseType: 'push-up' },
    ...over,
  } as unknown as AuthRequest)

describe('analyzeVideo', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default to a cache miss so the existing cases exercise the analyze path.
    mockHashFile.mockResolvedValue('hash1')
    mockBuildKey.mockReturnValue('hash1:push-up:left')
    mockOutputFilename.mockReturnValue('hash1_push-up_left.mp4')
    mockCacheGet.mockResolvedValue(null)
    mockCacheSet.mockResolvedValue(undefined)
  })

  it('returns 400 when no file is provided', async () => {
    const res = makeRes()
    await analyzeVideo(makeReq({ file: undefined }), res)
    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(400)
  })

  it('returns 400 for an unknown exerciseType and cleans up the temp file', async () => {
    const res = makeRes()
    await analyzeVideo(makeReq({ body: { exerciseType: 'cartwheel' } }), res)
    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(400)
    expect(fs.unlink).toHaveBeenCalled()
    expect(mockAnalyze).not.toHaveBeenCalled()
  })

  it('returns { analysisId, evaluation } and persists on the happy path', async () => {
    mockAnalyze.mockResolvedValue({ evaluation })
    mockSave.mockResolvedValue({ _id: 'pa1' })
    const res = makeRes()

    await analyzeVideo(makeReq(), res)

    expect(mockSave).toHaveBeenCalledWith('user1', 'push-up', 'x.mp4', evaluation)
    expect((res.json as jest.Mock).mock.calls[0][0]).toEqual({ analysisId: 'pa1', evaluation })
    expect(fs.unlink).toHaveBeenCalledWith('/tmp/x.mp4', expect.any(Function))
  })

  it('accepts a bare evaluation object (no wrapper)', async () => {
    mockAnalyze.mockResolvedValue(evaluation)
    mockSave.mockResolvedValue({ _id: 'pa2' })
    const res = makeRes()

    await analyzeVideo(makeReq(), res)

    expect((res.json as jest.Mock).mock.calls[0][0]).toEqual({ analysisId: 'pa2', evaluation })
  })

  it('returns 502 when the evaluator returns no usable evaluation', async () => {
    mockAnalyze.mockResolvedValue({ nope: true })
    const res = makeRes()
    await analyzeVideo(makeReq(), res)
    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(502)
  })

  it('still returns the evaluation when persistence fails', async () => {
    mockAnalyze.mockResolvedValue({ evaluation })
    mockSave.mockRejectedValue(new Error('db down'))
    const res = makeRes()

    await analyzeVideo(makeReq(), res)

    const payload = (res.json as jest.Mock).mock.calls[0][0]
    expect(payload.evaluation).toEqual(evaluation)
    expect(payload.analysisId).toBeUndefined()
  })

  it('returns 500 when the adapter throws', async () => {
    mockAnalyze.mockRejectedValue(new Error('evaluator boom'))
    const res = makeRes()
    await analyzeVideo(makeReq(), res)
    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(500)
    expect(fs.unlink).toHaveBeenCalled()
  })
})

describe('analyzeVideo content-hash cache', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockHashFile.mockResolvedValue('hash1')
    mockBuildKey.mockReturnValue('hash1:push-up:left')
    mockOutputFilename.mockReturnValue('hash1_push-up_left.mp4')
    mockCacheGet.mockResolvedValue(null)
    mockCacheSet.mockResolvedValue(undefined)
    mockSave.mockResolvedValue({ _id: 'pa1' })
  })

  it('stores the rewritten evaluation on a miss and tags the video with the hash', async () => {
    const withVideo = { ...evaluation, analized_video_url: 'http://svc:8002/videos/hash1_push-up_left.mp4' }
    mockAnalyze.mockResolvedValue({ evaluation: withVideo })
    const req = makeReq()
    const res = makeRes()

    await analyzeVideo(req, res)

    expect(mockAnalyze).toHaveBeenCalledTimes(1)
    expect((req.file as { outputFilename?: string }).outputFilename).toBe('hash1_push-up_left.mp4')
    expect(mockCacheSet).toHaveBeenCalledWith(
      'hash1:push-up:left',
      expect.objectContaining({ analized_video_url: '/api/video/stream/hash1_push-up_left.mp4' })
    )
    expect((res.json as jest.Mock).mock.calls[0][0].cached).toBeUndefined()
  })

  it('serves a hit without calling the pose service but still records history', async () => {
    const cachedEvaluation = { ...evaluation, analized_video_url: '/api/video/stream/hash1_push-up_left.mp4' }
    mockCacheGet.mockResolvedValue(cachedEvaluation)
    const res = makeRes()

    await analyzeVideo(makeReq(), res)

    expect(mockAnalyze).not.toHaveBeenCalled()
    expect(mockCacheSet).not.toHaveBeenCalled()
    expect(mockSave).toHaveBeenCalledWith(
      'user1',
      'push-up',
      '/api/video/stream/hash1_push-up_left.mp4',
      cachedEvaluation
    )
    expect((res.json as jest.Mock).mock.calls[0][0]).toEqual({
      analysisId: 'pa1',
      evaluation: cachedEvaluation,
      cached: true,
    })
    expect(fs.unlink).toHaveBeenCalledWith('/tmp/x.mp4', expect.any(Function))
  })

  it('falls back to a normal analysis when hashing fails', async () => {
    mockHashFile.mockRejectedValue(new Error('read error'))
    mockAnalyze.mockResolvedValue({ evaluation })
    const res = makeRes()

    await analyzeVideo(makeReq(), res)

    expect(mockAnalyze).toHaveBeenCalledTimes(1)
    expect(mockCacheSet).not.toHaveBeenCalled()
    expect((res.json as jest.Mock).mock.calls[0][0].evaluation).toEqual(evaluation)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('still returns the evaluation when storing it in the cache fails', async () => {
    mockAnalyze.mockResolvedValue({ evaluation })
    mockCacheSet.mockRejectedValue(new Error('db down'))
    const res = makeRes()

    await analyzeVideo(makeReq(), res)

    expect((res.json as jest.Mock).mock.calls[0][0].evaluation).toEqual(evaluation)
    expect(res.status).not.toHaveBeenCalled()
  })
})

describe('listAnalyses', () => {
  beforeEach(() => jest.clearAllMocks())

  it('maps the recent docs through the DTO mapper', async () => {
    mockList.mockResolvedValue([{ _id: 'pa1' }, { _id: 'pa2' }])
    mockToDto.mockImplementation((d: { _id: string }) => ({ id: d._id }))
    const res = makeRes()

    await listAnalyses(makeReq(), res)

    expect(mockList).toHaveBeenCalledWith('user1')
    expect((res.json as jest.Mock).mock.calls[0][0]).toEqual([{ id: 'pa1' }, { id: 'pa2' }])
  })

  it('returns 500 when listing fails', async () => {
    mockList.mockRejectedValue(new Error('db down'))
    const res = makeRes()
    await listAnalyses(makeReq(), res)
    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(500)
  })
})
