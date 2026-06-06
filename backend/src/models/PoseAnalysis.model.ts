import mongoose, { Schema, Document, Types } from 'mongoose'
import { Evaluation } from '../types'

export interface IPoseAnalysis extends Document {
  userId: Types.ObjectId
  exerciseName: string
  score: number
  isGoodTechnique: boolean
  summary: string
  issuesCount: number
  cameraView?: string
  status: 'done' | 'failed'
  videoPath?: string
  evaluation: Evaluation
  createdAt: Date
}

const poseAnalysisSchema = new Schema<IPoseAnalysis>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    exerciseName: { type: String, required: true },
    score: { type: Number, required: true },
    isGoodTechnique: { type: Boolean, default: false },
    summary: { type: String, default: '' },
    issuesCount: { type: Number, default: 0 },
    cameraView: String,
    status: { type: String, enum: ['done', 'failed'], default: 'done' },
    videoPath: String,
    // Full evaluator output kept verbatim for a future detail view.
    evaluation: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

poseAnalysisSchema.index({ userId: 1, createdAt: -1 })

export const PoseAnalysis = mongoose.model<IPoseAnalysis>('PoseAnalysis', poseAnalysisSchema)
