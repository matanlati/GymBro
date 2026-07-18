export interface WeeklyActivity {
  weekStart: string
  weekEnd: string
  workoutCount: number
}

export interface CalendarMetrics {
  currentStreakDays: number
  bestStreakDays: number
  weeklyActivity: WeeklyActivity[]
}

export const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format()
    return true
  } catch {
    return false
  }
}

const toDateKey = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value
  return `${value('year')}-${value('month')}-${value('day')}`
}

const addDays = (dateKey: string, amount: number): string => {
  const date = new Date(`${dateKey}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

const startOfWeek = (dateKey: string): string => {
  const day = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay()
  return addDays(dateKey, -(day === 0 ? 6 : day - 1))
}

export const calculateCalendarMetrics = (
  completedDates: Date[],
  timeZone: string,
  now = new Date()
): CalendarMetrics => {
  const dateKeys = completedDates.map(date => toDateKey(date, timeZone))
  const uniqueDays = [...new Set(dateKeys)].sort()
  const daySet = new Set(uniqueDays)

  let bestStreakDays = 0
  let run = 0
  let previous: string | undefined
  for (const day of uniqueDays) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1
    bestStreakDays = Math.max(bestStreakDays, run)
    previous = day
  }

  const today = toDateKey(now, timeZone)
  let cursor = daySet.has(today) ? today : addDays(today, -1)
  let currentStreakDays = 0
  while (daySet.has(cursor)) {
    currentStreakDays += 1
    cursor = addDays(cursor, -1)
  }

  const currentWeekStart = startOfWeek(today)
  const counts = new Map<string, number>()
  for (const day of dateKeys) {
    const week = startOfWeek(day)
    counts.set(week, (counts.get(week) ?? 0) + 1)
  }

  const weeklyActivity = Array.from({ length: 6 }, (_, index) => {
    const weekStart = addDays(currentWeekStart, (index - 5) * 7)
    return {
      weekStart,
      weekEnd: addDays(weekStart, 6),
      workoutCount: counts.get(weekStart) ?? 0,
    }
  })

  return { currentStreakDays, bestStreakDays, weeklyActivity }
}
