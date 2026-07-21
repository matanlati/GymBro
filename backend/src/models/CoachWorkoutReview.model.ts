import mongoose, { Document, Schema, Types } from 'mongoose'

export interface ICoachWorkoutReview extends Document {
  coachId: Types.ObjectId
  traineeId: Types.ObjectId
  sessionId: Types.ObjectId
  reviewedAt: Date
}

const coachWorkoutReviewSchema = new Schema<ICoachWorkoutReview>(
  {
    coachId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    traineeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'WorkoutSession', required: true, index: true },
    reviewedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false }
)

coachWorkoutReviewSchema.index({ coachId: 1, sessionId: 1 }, { unique: true })

export const CoachWorkoutReview = mongoose.model<ICoachWorkoutReview>(
  'CoachWorkoutReview',
  coachWorkoutReviewSchema
)
