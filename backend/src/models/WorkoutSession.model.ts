import mongoose, { Schema, Document, Types } from 'mongoose'

export interface ISetLog {
  setNumber: number
  repsCompleted: number
  weightUsedKg?: number
  loggedAt: Date
}

export interface IExerciseLog {
  exerciseKey?: string
  name: string
  muscleGroups?: string[]
  prescribedSets: string
  prescribedReps: string
  prescribedWeightKg?: number
  orderIndex: number
  sets: ISetLog[]
}

export interface IWorkoutSession extends Document {
  userId: Types.ObjectId
  planId: Types.ObjectId
  title?: string
  dayIndex: number
  scheduledDate: Date
  startedAt: Date
  completedAt?: Date
  notes?: string
  exercises: IExerciseLog[]
}

const setLogSchema = new Schema<ISetLog>(
  {
    setNumber: { type: Number, required: true },
    repsCompleted: { type: Number, required: true },
    weightUsedKg: Number,
    loggedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const exerciseLogSchema = new Schema<IExerciseLog>(
  {
    exerciseKey: { type: String, trim: true },
    name: { type: String, required: true },
    muscleGroups: { type: [String], default: undefined },
    prescribedSets: { type: String, required: true },
    prescribedReps: { type: String, required: true },
    prescribedWeightKg: Number,
    orderIndex: { type: Number, required: true },
    sets: { type: [setLogSchema], default: [] },
  },
  { _id: false }
)

const workoutSessionSchema = new Schema<IWorkoutSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: 'WorkoutPlan', required: true, index: true },
    title: String,
    dayIndex: { type: Number, required: true },
    scheduledDate: { type: Date, required: true },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: Date,
    notes: String,
    exercises: { type: [exerciseLogSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

workoutSessionSchema.index({ userId: 1, scheduledDate: 1 })

export const WorkoutSession = mongoose.model<IWorkoutSession>('WorkoutSession', workoutSessionSchema)
