import path from 'path'
import fs from 'fs'
import { User } from '../models/User.model'
import { createMeasurement } from './bodyMeasurements.service'

export async function getMe(userId: string) {
  const user = await User.findById(userId)
    .select('-passwordHash')
    .populate('coachId', 'name email photo')
  if (!user) throw new Error('USER_NOT_FOUND')
  return user
}

export async function updateMe(userId: string, updates: {
  name?: string
  age?: number
  weightKg?: number
  heightCm?: number
  fitnessLevel?: string
  goals?: string
  limitations?: string
  timezone?: string
}) {
  const allowed = ['name', 'age', 'weightKg', 'heightCm', 'fitnessLevel', 'goals', 'limitations', 'timezone']
  const sanitized = Object.fromEntries(
    Object.entries(updates).filter(([k, v]) => allowed.includes(k) && v !== undefined && v !== '')
  )

  const currentUser = await User.findById(userId).select('weightKg')
  if (!currentUser) throw new Error('USER_NOT_FOUND')

  const nextWeight = sanitized.weightKg
  if (typeof nextWeight === 'number' && nextWeight !== currentUser.weightKg) {
    await createMeasurement(userId, { weightKg: nextWeight })
  }
  delete sanitized.weightKg

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: sanitized },
    { new: true, runValidators: true }
  ).select('-passwordHash').populate('coachId', 'name email photo')

  if (!user) throw new Error('USER_NOT_FOUND')
  return user
}

export async function updatePhoto(userId: string, file: Express.Multer.File) {
  const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
  const avatarsDir = path.resolve(process.cwd(), 'uploads/avatars')
  if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true })

  const dest = path.join(avatarsDir, `${userId}${ext}`)

  for (const f of fs.readdirSync(avatarsDir)) {
    if (f.startsWith(userId) && f !== path.basename(dest)) {
      fs.unlinkSync(path.join(avatarsDir, f))
    }
  }

  fs.renameSync(file.path, dest)
  const photoUrl = `/uploads/avatars/${userId}${ext}`

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { photo: photoUrl } },
    { new: true }
  ).select('-passwordHash').populate('coachId', 'name email photo')

  if (!user) throw new Error('USER_NOT_FOUND')
  return user
}
