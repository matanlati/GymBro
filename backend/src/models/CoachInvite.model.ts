import mongoose, { Schema, Document, Types } from 'mongoose'

export type CoachInviteStatus = 'pending' | 'accepted' | 'declined'

export interface ICoachInvite extends Document {
  coachId: Types.ObjectId
  traineeId: Types.ObjectId
  traineeEmail: string
  status: CoachInviteStatus
  createdAt: Date
  acceptedAt?: Date
}

const coachInviteSchema = new Schema<ICoachInvite>(
  {
    coachId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    traineeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    traineeEmail: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], required: true, default: 'pending' },
    acceptedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

coachInviteSchema.index({ coachId: 1, traineeId: 1, status: 1 })

export const CoachInvite = mongoose.model<ICoachInvite>('CoachInvite', coachInviteSchema)
