import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IWeightEntry extends Document {
  userId: Types.ObjectId
  weightKg: number
  recordedAt: Date
  createdAt: Date
}

const weightEntrySchema = new Schema<IWeightEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    weightKg: { type: Number, required: true, min: 20, max: 400 },
    recordedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

weightEntrySchema.index({ userId: 1, recordedAt: 1 })

export const WeightEntry = mongoose.model<IWeightEntry>('WeightEntry', weightEntrySchema)
