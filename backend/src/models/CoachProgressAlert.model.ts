import mongoose, { Document, Schema, Types } from 'mongoose'

export interface ICoachProgressAlertClear extends Document {
  coachId: Types.ObjectId
  traineeId: Types.ObjectId
  workoutKey: string
  clearedAt: Date
}

const coachProgressAlertClearSchema = new Schema<ICoachProgressAlertClear>(
  {
    coachId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    traineeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workoutKey: { type: String, required: true, maxlength: 300 },
    clearedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false }
)

coachProgressAlertClearSchema.index(
  { coachId: 1, traineeId: 1, workoutKey: 1 },
  { unique: true }
)

export const CoachProgressAlertClear = mongoose.model<ICoachProgressAlertClear>(
  'CoachProgressAlertClear',
  coachProgressAlertClearSchema
)
