import mongoose, { Document, Schema, Types } from 'mongoose'

export type ProgressGoalType =
  | 'weekly_workouts'
  | 'exercise_strength'
  | 'body_weight'
  | 'muscle_mass'

export type ProgressGoalUnit = 'workouts' | 'kg'
export type ProgressGoalStatus = 'active' | 'completed' | 'archived'

export interface IProgressGoal extends Document {
  userId: Types.ObjectId
  type: ProgressGoalType
  exerciseKey?: string
  exerciseName?: string
  baselineValue?: number
  targetValue: number
  unit: ProgressGoalUnit
  startsAt: Date
  targetDate?: Date
  status: ProgressGoalStatus
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const expectedUnit: Record<ProgressGoalType, ProgressGoalUnit> = {
  weekly_workouts: 'workouts',
  exercise_strength: 'kg',
  body_weight: 'kg',
  muscle_mass: 'kg',
}

const progressGoalSchema = new Schema<IProgressGoal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['weekly_workouts', 'exercise_strength', 'body_weight', 'muscle_mass'],
      required: true,
    },
    exerciseKey: { type: String, trim: true },
    exerciseName: { type: String, trim: true },
    baselineValue: { type: Number, min: 0 },
    targetValue: { type: Number, required: true, min: 0.1 },
    unit: {
      type: String,
      enum: ['workouts', 'kg'],
      required: true,
      validate: {
        validator(this: IProgressGoal, unit: ProgressGoalUnit) {
          return expectedUnit[this.type] === unit
        },
        message: 'unit does not match the goal type',
      },
    },
    startsAt: { type: Date, required: true, default: Date.now },
    targetDate: Date,
    status: {
      type: String,
      enum: ['active', 'completed', 'archived'],
      required: true,
      default: 'active',
    },
    completedAt: Date,
  },
  { timestamps: true }
)

progressGoalSchema.pre('validate', function validateExerciseGoal(next) {
  if (this.type === 'exercise_strength' && (!this.exerciseKey || !this.exerciseName)) {
    this.invalidate('exerciseKey', 'exerciseKey and exerciseName are required for strength goals')
  }
  next()
})

progressGoalSchema.index({ userId: 1, status: 1, createdAt: -1 })

export const ProgressGoal = mongoose.model<IProgressGoal>('ProgressGoal', progressGoalSchema)
