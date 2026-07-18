import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IBodyMeasurement extends Document {
  userId: Types.ObjectId
  measuredAt: Date
  weightKg?: number
  bodyFatPercent?: number
  muscleMassKg?: number
  createdAt: Date
  updatedAt: Date
}

const bodyMeasurementSchema = new Schema<IBodyMeasurement>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    measuredAt: { type: Date, required: true, default: Date.now },
    weightKg: { type: Number, min: 0.1 },
    bodyFatPercent: { type: Number, min: 0, max: 100 },
    muscleMassKg: { type: Number, min: 0.1 },
  },
  { timestamps: true }
)

bodyMeasurementSchema.pre('validate', function requireMeasurementValue(next) {
  if (
    this.weightKg === undefined &&
    this.bodyFatPercent === undefined &&
    this.muscleMassKg === undefined
  ) {
    this.invalidate('weightKg', 'at least one body measurement value is required')
  }
  next()
})

bodyMeasurementSchema.index({ userId: 1, measuredAt: -1 })

export const BodyMeasurement = mongoose.model<IBodyMeasurement>(
  'BodyMeasurement',
  bodyMeasurementSchema
)
