import { createMeasurement, listMeasurements } from './bodyMeasurements.service'

export interface WeightEntryDTO {
  _id: string
  weightKg: number
  recordedAt: string
  createdAt: string
}

const toDTO = (entry: {
  _id: { toString(): string }
  weightKg: number
  measuredAt: Date
  createdAt: Date
}): WeightEntryDTO => ({
  _id: entry._id.toString(),
  weightKg: entry.weightKg,
  recordedAt: entry.measuredAt.toISOString(),
  createdAt: entry.createdAt.toISOString(),
})

export async function listWeights(userId: string): Promise<WeightEntryDTO[]> {
  const measurements = await listMeasurements(userId, { limit: 365 })
  return measurements
    .filter((entry): entry is typeof entry & { weightKg: number } => entry.weightKg !== undefined)
    .slice(0, 90)
    .reverse()
    .map(toDTO)
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

  const entry = await createMeasurement(userId, {
    weightKg,
    measuredAt: recordedAt,
  })

  return toDTO(entry as typeof entry & { weightKg: number })
}
