import mongoose, { Schema, Document, Types } from 'mongoose'
import { QuestionnaireData } from '../types'

export interface IExercise {
  name: string
  sets: string
  reps: string
  notes?: string
}

export interface IDayPlan {
  day: string
  focus: string
  exercises: IExercise[]
}

export interface IWorkoutPlan extends Document {
  userId: Types.ObjectId
  title: string
  programType?: string
  summary: string
  weeklyPlan: IDayPlan[]
  safetyNotes: string[]
  progressionNotes: string
  questionnaireData?: QuestionnaireData
  isActive: boolean
  createdAt: Date
}

const exerciseSchema = new Schema<IExercise>(
  {
    name: { type: String, required: true },
    sets: { type: String, required: true },
    reps: { type: String, required: true },
    notes: String,
  },
  { _id: false }
)

const dayPlanSchema = new Schema<IDayPlan>(
  {
    day: { type: String, required: true },
    focus: { type: String, required: true },
    exercises: { type: [exerciseSchema], default: [] },
  },
  { _id: false }
)

const workoutPlanSchema = new Schema<IWorkoutPlan>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    programType: String,
    summary: { type: String, required: true },
    weeklyPlan: { type: [dayPlanSchema], default: [] },
    safetyNotes: { type: [String], default: [] },
    progressionNotes: { type: String, default: '' },
    questionnaireData: { type: Schema.Types.Mixed, default: undefined },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

workoutPlanSchema.index({ userId: 1, isActive: 1 })

export const WorkoutPlan = mongoose.model<IWorkoutPlan>('WorkoutPlan', workoutPlanSchema)
