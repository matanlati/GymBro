import { Types } from 'mongoose'
import { WeightEntry } from '../models/WeightEntry.model'
import { User } from '../models/User.model'

export interface WeightEntryDTO {
  _id: string
  weightKg: number
  recordedAt: string
  createdAt: string
}

const toDTO = (entry: {
  _id: Types.ObjectId
  weightKg: number
  recordedAt: Date
  createdAt: Date
}): WeightEntryDTO => ({
  _id: entry._id.toString(),
  weightKg: entry.weightKg,
  recordedAt: entry.recordedAt.toISOString(),
  createdAt: entry.createdAt.toISOString(),
})

export async function listWeights(userId: string): Promise<WeightEntryDTO[]> {
  const entries = await WeightEntry.find({ userId: new Types.ObjectId(userId) })
    .sort({ recordedAt: 1, createdAt: 1 })
    .limit(90)
    .lean()

  return entries.map(toDTO)
}

export async function createWeight(userId: string, payload: { weightKg?: number; recordedAt?: string }): Promise<WeightEntryDTO> {
  const weightKg = Number(payload.weightKg)
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400) {
    throw new Error('INVALID_WEIGHT')
  }

  const recordedAt = payload.recordedAt ? new Date(payload.recordedAt) : new Date()
  if (Number.isNaN(recordedAt.getTime())) {
    throw new Error('INVALID_DATE')
  }

  const entry = await WeightEntry.create({
    userId: new Types.ObjectId(userId),
    weightKg,
    recordedAt,
  })

  await User.findByIdAndUpdate(userId, { $set: { weightKg } })

  return toDTO({
    _id: entry._id as Types.ObjectId,
    weightKg: entry.weightKg,
    recordedAt: entry.recordedAt,
    createdAt: entry.createdAt,
  })
}
