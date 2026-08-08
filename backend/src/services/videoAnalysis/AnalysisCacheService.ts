import crypto from 'crypto'
import fs from 'fs'
import { AnalysisCache } from '../../models/AnalysisCache.model'
import { Evaluation } from '../../types'

// The pose service defaults `side` to "left" when the field is omitted, so an
// absent side must hash to the same key as an explicit "left".
const DEFAULT_SIDE = 'left'

class AnalysisCacheService {
  // Streamed so a 100MB upload is never held in memory here -- the adapter
  // already buffers the whole file once when it builds the multipart body.
  hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256')
      const stream = fs.createReadStream(filePath)
      stream.on('data', (chunk) => hash.update(chunk))
      stream.on('error', reject)
      stream.on('end', () => resolve(hash.digest('hex')))
    })
  }

  buildKey(hash: string, exerciseType: string, side?: string): string {
    return `${hash}:${exerciseType}:${side || DEFAULT_SIDE}`
  }

  // Content-derived name for the annotated video the pose service writes, so
  // re-analyzing the same clip overwrites one file instead of adding another.
  // Every exercise key and side is [A-Za-z0-9._-], so the result passes
  // isSafeFilename in videoProxy.ts.
  outputFilename(hash: string, exerciseType: string, side?: string): string {
    return `${hash}_${exerciseType}_${side || DEFAULT_SIDE}.mp4`
  }

  async get(cacheKey: string): Promise<Evaluation | null> {
    const doc = await AnalysisCache.findOne({ cacheKey })
    return doc ? doc.evaluation : null
  }

  async set(cacheKey: string, evaluation: Evaluation): Promise<void> {
    await AnalysisCache.findOneAndUpdate({ cacheKey }, { cacheKey, evaluation }, { upsert: true })
  }
}

export default new AnalysisCacheService()
