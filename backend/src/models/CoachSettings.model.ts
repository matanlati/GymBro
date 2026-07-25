import mongoose, { Document, Schema, Types } from 'mongoose'

export interface ICoachSettings extends Document {
  coachId: Types.ObjectId
  inactivityDays: number
  stagnantWorkoutCount: number
}

const coachSettingsSchema = new Schema<ICoachSettings>(
  {
    coachId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    inactivityDays: { type: Number, required: true, min: 1, max: 90, default: 7 },
    stagnantWorkoutCount: { type: Number, required: true, min: 2, max: 10, default: 3 },
  },
  { timestamps: false }
)

export const CoachSettings = mongoose.model<ICoachSettings>('CoachSettings', coachSettingsSchema)
