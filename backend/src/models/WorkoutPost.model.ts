import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IWorkoutComment {
  userId: Types.ObjectId
  text: string
  createdAt: Date
}

export interface IWorkoutPost extends Document {
  userId: Types.ObjectId
  sessionId?: Types.ObjectId
  shoutoutTraineeId?: Types.ObjectId
  workoutName: string
  title: string
  caption: string
  postDate: Date
  photoUrl?: string
  likedBy: Types.ObjectId[]
  comments: IWorkoutComment[]
  createdAt: Date
}

const workoutCommentSchema = new Schema<IWorkoutComment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
)

const workoutPostSchema = new Schema<IWorkoutPost>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'WorkoutSession', index: true },
    shoutoutTraineeId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    workoutName: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    caption: { type: String, default: '', trim: true },
    postDate: { type: Date, required: true, index: true },
    photoUrl: String,
    likedBy: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    comments: { type: [workoutCommentSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

workoutPostSchema.index({ postDate: -1, createdAt: -1 })

export const WorkoutPost = mongoose.model<IWorkoutPost>('WorkoutPost', workoutPostSchema)
