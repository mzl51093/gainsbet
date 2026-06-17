/** Returns today's date string in Eastern time (YYYY-MM-DD) */
export function getTodayEastern(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

/** Returns the current hour (0-23) in Eastern time */
export function getEasternHour(): number {
  return Number(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false })
  )
}

/**
 * Returns the effective check-in date: before noon ET, credits yesterday.
 * At noon or later, credits today.
 */
export function getCheckinDateEastern(): string {
  const hour = getEasternHour()
  if (hour < 12) {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  }
  return getTodayEastern()
}

/** Returns the Eastern UTC offset in hours (e.g., -4 for EDT, -5 for EST) */
export function getEasternOffsetHours(): number {
  // Use UTC noon to avoid midnight rollover issues
  const now = new Date()
  const noonUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0))
  const noonEasternHour = Number(
    noonUTC.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false })
  )
  return noonEasternHour - 12 // -4 for EDT, -5 for EST
}

/**
 * Returns the UTC ISO string for the END of dateStr in Eastern time.
 * e.g., end of '2026-05-14' EDT = '2026-05-15T04:00:00.000Z'
 */
export function getEndOfDayEasternISO(dateStr: string): string {
  const absOffset = -getEasternOffsetHours() // 4 for EDT, 5 for EST
  const [y, m, d] = dateStr.split('-').map(Number)
  const nextDayUTC = new Date(Date.UTC(y, m - 1, d + 1, absOffset, 0, 0))
  return nextDayUTC.toISOString()
}

/**
 * Returns a Date object for midnight Eastern on the given date string.
 * Safe to use for day-level arithmetic.
 */
export function getEasternMidnight(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/**
 * Returns days remaining from Eastern today until endDateStr (inclusive).
 * Returns 0 if today >= endDate in Eastern.
 */
export function daysLeftEastern(endDateStr: string): number {
  const todayStr = getTodayEastern()
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const [ey, em, ed] = endDateStr.split('-').map(Number)
  const todayMs = Date.UTC(ty, tm - 1, td)
  const endMs = Date.UTC(ey, em - 1, ed)
  return Math.max(0, Math.round((endMs - todayMs) / 86400000))
}
