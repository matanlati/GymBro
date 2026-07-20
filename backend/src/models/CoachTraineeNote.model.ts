import mongoose, { Document, Schema, Types } from 'mongoose'

export interface ICoachTraineeNote extends Document {
  coachId: Types.ObjectId
  traineeId: Types.ObjectId
  notes: string
  createdAt: Date
  updatedAt: Date
}

const coachTraineeNoteSchema = new Schema<ICoachTraineeNote>(
  {
    coachId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    traineeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    notes: { type: String, default: '', maxlength: 5000 },
  },
  { timestamps: true }
)

coachTraineeNoteSchema.index({ coachId: 1, traineeId: 1 }, { unique: true })

export const CoachTraineeNote = mongoose.model<ICoachTraineeNote>('CoachTraineeNote', coachTraineeNoteSchema)
