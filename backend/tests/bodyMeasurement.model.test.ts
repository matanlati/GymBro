import { Types } from 'mongoose'
import { BodyMeasurement } from '../src/models/BodyMeasurement.model'

const userId = new Types.ObjectId()

describe('BodyMeasurement model', () => {
  it('accepts a dated measurement with any supported value', async () => {
    const measurement = new BodyMeasurement({
      userId,
      measuredAt: new Date('2026-07-18T08:00:00.000Z'),
      weightKg: 78.4,
    })

    await expect(measurement.validate()).resolves.toBeUndefined()
  })

  it('accepts multiple body composition values together', async () => {
    const measurement = new BodyMeasurement({
      userId,
      bodyFatPercent: 18.2,
      muscleMassKg: 34.5,
    })

    await expect(measurement.validate()).resolves.toBeUndefined()
    expect(measurement.measuredAt).toBeInstanceOf(Date)
  })

  it('requires at least one measurement value', async () => {
    const measurement = new BodyMeasurement({ userId })

    await expect(measurement.validate()).rejects.toThrow(
      'at least one body measurement value is required'
    )
  })

  it('rejects a body-fat percentage outside the valid range', async () => {
    const measurement = new BodyMeasurement({
      userId,
      bodyFatPercent: 101,
    })

    await expect(measurement.validate()).rejects.toThrow()
  })
})
