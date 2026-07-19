import mongoose, { Schema, Document, Types } from 'mongoose'
import { isValidTimeZone } from '../utils/calendarMetrics'

export interface IUser extends Document {
  email: string
  passwordHash: string
  name: string
  role: 'trainee' | 'coach'
  coachId?: Types.ObjectId
  age?: number
  weightKg?: number
  heightCm?: number
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced'
  goals?: string
  limitations?: string
  photo?: string
  timezone: string
  createdAt: Date
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['trainee', 'coach'], required: true, default: 'trainee' },
    coachId: { type: Schema.Types.ObjectId, ref: 'User', default: undefined },
    age: Number,
    weightKg: Number,
    heightCm: Number,
    fitnessLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
    goals: String,
    limitations: String,
    photo: String,
    timezone: {
      type: String,
      required: true,
      default: 'UTC',
      validate: { validator: isValidTimeZone, message: 'timezone must be a valid IANA timezone' },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

export const User = mongoose.model<IUser>('User', userSchema)
