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
  coachExperienceYears?: number
  coachingSpecialties?: string[]
  certifications?: string
  coachingBio?: string
  preferredTraineeLevels?: Array<'beginner' | 'intermediate' | 'advanced'>
  coachingAvailability?: string
  maxTrainees?: number
  acceptingNewTrainees?: boolean
  contactPreference?: 'in_app' | 'email'
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
    coachExperienceYears: { type: Number, min: 0, max: 70 },
    coachingSpecialties: [{ type: String, trim: true }],
    certifications: String,
    coachingBio: String,
    preferredTraineeLevels: [{ type: String, enum: ['beginner', 'intermediate', 'advanced'] }],
    coachingAvailability: String,
    maxTrainees: { type: Number, min: 1, max: 500, default: 20 },
    acceptingNewTrainees: { type: Boolean, default: true },
    contactPreference: { type: String, enum: ['in_app', 'email'], default: 'in_app' },
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
