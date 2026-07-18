import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IWorkoutPost extends Document {
  userId: Types.ObjectId
  sessionId: Types.ObjectId
  workoutName: string
  title: string
  caption: string
  postDate: Date
  photoUrl?: string
  createdAt: Date
}

const workoutPostSchema = new Schema<IWorkoutPost>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'WorkoutSession', required: true, index: true },
    workoutName: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    caption: { type: String, default: '', trim: true },
    postDate: { type: Date, required: true, index: true },
    photoUrl: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

workoutPostSchema.index({ postDate: -1, createdAt: -1 })

export const WorkoutPost = mongoose.model<IWorkoutPost>('WorkoutPost', workoutPostSchema)
