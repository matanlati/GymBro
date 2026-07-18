import { BodyMeasurement, IBodyMeasurement } from '../models/BodyMeasurement.model'
import { User } from '../models/User.model'

export interface BodyMeasurementPayload {
  measuredAt?: string | Date
  weightKg?: number
  bodyFatPercent?: number
  muscleMassKg?: number
}

export interface MeasurementFilters {
  from?: string
  to?: string
  limit?: number
}

const parseDate = (value: string | Date | undefined): Date | undefined => {
  if (value === undefined) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('INVALID_MEASUREMENT_PAYLOAD')
  return date
}

const validateValue = (value: number | undefined, max?: number): void => {
  if (value === undefined) return
  if (!Number.isFinite(value) || value < 0 || (max !== undefined && value > max)) {
    throw new Error('INVALID_MEASUREMENT_PAYLOAD')
  }
}

const validatePayload = (payload: BodyMeasurementPayload, requireValue: boolean): void => {
  validateValue(payload.weightKg)
  validateValue(payload.bodyFatPercent, 100)
  validateValue(payload.muscleMassKg)
  const hasValue = payload.weightKg !== undefined ||
    payload.bodyFatPercent !== undefined ||
    payload.muscleMassKg !== undefined
  if (requireValue && !hasValue) throw new Error('INVALID_MEASUREMENT_PAYLOAD')
}

const syncLatestWeight = async (userId: string): Promise<void> => {
  const latest = await BodyMeasurement.findOne({
    userId,
    weightKg: { $exists: true },
  }).sort({ measuredAt: -1 })

  if (latest?.weightKg !== undefined) {
    await User.findByIdAndUpdate(userId, { $set: { weightKg: latest.weightKg } })
  }
}

export const listMeasurements = async (
  userId: string,
  filters: MeasurementFilters = {}
): Promise<IBodyMeasurement[]> => {
  const limit = filters.limit ?? 100
  if (!Number.isInteger(limit) || limit < 1 || limit > 365) {
    throw new Error('INVALID_MEASUREMENT_FILTERS')
  }

  const measuredAt: { $gte?: Date; $lte?: Date } = {}
  if (filters.from) measuredAt.$gte = parseDate(filters.from)
  if (filters.to) measuredAt.$lte = parseDate(filters.to)
  if (measuredAt.$gte && measuredAt.$lte && measuredAt.$gte > measuredAt.$lte) {
    throw new Error('INVALID_MEASUREMENT_FILTERS')
  }

  const query = Object.keys(measuredAt).length > 0 ? { userId, measuredAt } : { userId }
  return BodyMeasurement.find(query).sort({ measuredAt: -1 }).limit(limit)
}

export const createMeasurement = async (
  userId: string,
  payload: BodyMeasurementPayload
): Promise<IBodyMeasurement> => {
  validatePayload(payload, true)
  const measurement = await BodyMeasurement.create({
    userId,
    measuredAt: parseDate(payload.measuredAt),
    weightKg: payload.weightKg,
    bodyFatPercent: payload.bodyFatPercent,
    muscleMassKg: payload.muscleMassKg,
  })
  await syncLatestWeight(userId)
  return measurement
}

export const updateMeasurement = async (
  userId: string,
  measurementId: string,
  payload: BodyMeasurementPayload
): Promise<IBodyMeasurement> => {
  validatePayload(payload, false)
  const measurement = await BodyMeasurement.findOne({ _id: measurementId, userId })
  if (!measurement) throw new Error('MEASUREMENT_NOT_FOUND')

  if (payload.measuredAt !== undefined) measurement.measuredAt = parseDate(payload.measuredAt)!
  if (payload.weightKg !== undefined) measurement.weightKg = payload.weightKg
  if (payload.bodyFatPercent !== undefined) measurement.bodyFatPercent = payload.bodyFatPercent
  if (payload.muscleMassKg !== undefined) measurement.muscleMassKg = payload.muscleMassKg

  const saved = await measurement.save()
  await syncLatestWeight(userId)
  return saved
}

export const deleteMeasurement = async (
  userId: string,
  measurementId: string
): Promise<void> => {
  const result = await BodyMeasurement.deleteOne({ _id: measurementId, userId })
  if (result.deletedCount === 0) throw new Error('MEASUREMENT_NOT_FOUND')
  await syncLatestWeight(userId)
}
