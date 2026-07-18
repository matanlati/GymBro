import { calculateCalendarMetrics, isValidTimeZone } from '../src/utils/calendarMetrics'

describe('calendar metrics', () => {
  it('validates IANA timezones', () => {
    expect(isValidTimeZone('Asia/Jerusalem')).toBe(true)
    expect(isValidTimeZone('Not/A_Timezone')).toBe(false)
  })

  it('calculates streaks using the user calendar day', () => {
    const metrics = calculateCalendarMetrics(
      [
        new Date('2026-07-16T22:30:00.000Z'), // July 17 in Jerusalem
        new Date('2026-07-17T22:30:00.000Z'), // July 18 in Jerusalem
      ],
      'Asia/Jerusalem',
      new Date('2026-07-18T12:00:00.000Z')
    )

    expect(metrics.currentStreakDays).toBe(2)
    expect(metrics.bestStreakDays).toBe(2)
  })

  it('returns six Monday-based activity buckets including empty weeks', () => {
    const metrics = calculateCalendarMetrics(
      [
        new Date('2026-07-13T10:00:00.000Z'),
        new Date('2026-07-15T10:00:00.000Z'),
      ],
      'UTC',
      new Date('2026-07-18T12:00:00.000Z')
    )

    expect(metrics.weeklyActivity).toHaveLength(6)
    expect(metrics.weeklyActivity.at(-1)).toEqual({
      weekStart: '2026-07-13',
      weekEnd: '2026-07-19',
      workoutCount: 2,
    })
  })
})
