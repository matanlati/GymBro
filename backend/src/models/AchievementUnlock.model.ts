import mongoose, { Document, Schema, Types } from 'mongoose'

export type AchievementCategory = 'workout_count' | 'streak' | 'personal_record'

export interface IAchievementUnlock extends Document {
  userId: Types.ObjectId
  achievementKey: string
  category: AchievementCategory
  value: number
  exerciseKey?: string
  exerciseName?: string
  unlockedAt: Date
  createdAt: Date
}

const achievementUnlockSchema = new Schema<IAchievementUnlock>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    achievementKey: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['workout_count', 'streak', 'personal_record'],
      required: true,
    },
    value: { type: Number, required: true, min: 1 },
    exerciseKey: { type: String, trim: true },
    exerciseName: { type: String, trim: true },
    unlockedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

achievementUnlockSchema.pre('validate', function validatePersonalRecord(next) {
  if (this.category === 'personal_record' && (!this.exerciseKey || !this.exerciseName)) {
    this.invalidate(
      'exerciseKey',
      'exerciseKey and exerciseName are required for personal-record achievements'
    )
  }
  next()
})

achievementUnlockSchema.index({ userId: 1, achievementKey: 1 }, { unique: true })
achievementUnlockSchema.index({ userId: 1, unlockedAt: -1 })

export const AchievementUnlock = mongoose.model<IAchievementUnlock>(
  'AchievementUnlock',
  achievementUnlockSchema
)
