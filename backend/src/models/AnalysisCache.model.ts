import mongoose, { Schema, Document } from 'mongoose'
import { Evaluation } from '../types'

// A completed evaluation keyed by the content hash of the source video.
// The pose pipeline is a pure function of (video bytes, exerciseType, side),
// so an identical upload can reuse a stored result instead of re-running it.
// Kept separate from PoseAnalysis: that model is per-user history and still
// gets a fresh row on every request, including cache hits.
export interface IAnalysisCache extends Document {
  cacheKey: string
  evaluation: Evaluation
  createdAt: Date
}

const analysisCacheSchema = new Schema<IAnalysisCache>(
  {
    // `${sha256}:${exerciseType}:${side}`
    cacheKey: { type: String, required: true, unique: true },
    // Stored after the analized_video_url rewrite, so a hit is served verbatim.
    evaluation: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

// Entries expire an hour after they are written. Mongo only drops the document,
// so the matching output_videos/ mp4 outlives it -- that is the safe direction:
// the next analysis of the same clip re-runs and overwrites the file under the
// same content-derived name. Never add a sweep that deletes the mp4 while
// leaving the row, which would leave a hit pointing at a missing video.
analysisCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 })

export const AnalysisCache = mongoose.model<IAnalysisCache>('AnalysisCache', analysisCacheSchema)
