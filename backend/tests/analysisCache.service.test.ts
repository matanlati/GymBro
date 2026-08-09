jest.mock('../src/models/AnalysisCache.model')

import fs from 'fs'
import os from 'os'
import path from 'path'
import { AnalysisCache } from '../src/models/AnalysisCache.model'
import AnalysisCacheService from '../src/services/videoAnalysis/AnalysisCacheService'
import { Evaluation } from '../src/types'

const MockAnalysisCache = AnalysisCache as jest.Mocked<typeof AnalysisCache>

const evaluation: Evaluation = {
  exerciseType: 'squat',
  score: 81,
  isGoodTechnique: true,
  scoreExplanation: 'why',
  overallSummary: 'summary',
  positiveFeedback: [],
  issues: [],
  recommendations: [],
  analized_video_url: '/api/video/stream/abc_squat_left.mp4',
}

const writeTempFile = (contents: string): string => {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gymbro-hash-')), 'clip.mp4')
  fs.writeFileSync(filePath, contents)
  return filePath
}

describe('AnalysisCacheService.hashFile', () => {
  it('returns the same digest for identical contents in different files', async () => {
    const a = await AnalysisCacheService.hashFile(writeTempFile('same bytes'))
    const b = await AnalysisCacheService.hashFile(writeTempFile('same bytes'))
    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns a different digest for different contents', async () => {
    const a = await AnalysisCacheService.hashFile(writeTempFile('one'))
    const b = await AnalysisCacheService.hashFile(writeTempFile('two'))
    expect(a).not.toBe(b)
  })

  it('rejects when the file cannot be read', async () => {
    await expect(AnalysisCacheService.hashFile('/tmp/does-not-exist-gymbro.mp4')).rejects.toThrow()
  })
})

describe('AnalysisCacheService key and filename derivation', () => {
  it('keys on hash, exercise type and side', () => {
    expect(AnalysisCacheService.buildKey('abc', 'squat', 'right')).toBe('abc:squat:right')
  })

  it('treats an omitted side as the service default of left', () => {
    expect(AnalysisCacheService.buildKey('abc', 'squat')).toBe('abc:squat:left')
    expect(AnalysisCacheService.outputFilename('abc', 'squat')).toBe('abc_squat_left.mp4')
  })

  it('builds a filename with only safe characters', () => {
    const name = AnalysisCacheService.outputFilename('abc123', 'push-up', 'left')
    expect(name).toBe('abc123_push-up_left.mp4')
    expect(name).toMatch(/^[A-Za-z0-9._-]+$/)
  })
})

describe('AnalysisCacheService.get / set', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns the stored evaluation on a hit', async () => {
    ;(MockAnalysisCache.findOne as jest.Mock) = jest.fn().mockResolvedValue({ evaluation })

    const result = await AnalysisCacheService.get('abc:squat:left')

    expect(MockAnalysisCache.findOne).toHaveBeenCalledWith({ cacheKey: 'abc:squat:left' })
    expect(result).toBe(evaluation)
  })

  it('returns null on a miss', async () => {
    ;(MockAnalysisCache.findOne as jest.Mock) = jest.fn().mockResolvedValue(null)
    expect(await AnalysisCacheService.get('abc:squat:left')).toBeNull()
  })

  it('upserts on set so a repeat store does not throw on the unique key', async () => {
    ;(MockAnalysisCache.findOneAndUpdate as jest.Mock) = jest.fn().mockResolvedValue(null)

    await AnalysisCacheService.set('abc:squat:left', evaluation)

    expect(MockAnalysisCache.findOneAndUpdate).toHaveBeenCalledWith(
      { cacheKey: 'abc:squat:left' },
      { cacheKey: 'abc:squat:left', evaluation },
      { upsert: true }
    )
  })
})
