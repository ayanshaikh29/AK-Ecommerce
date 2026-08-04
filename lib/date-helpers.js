// ========================================================
// IST-Aware Date Range Helpers
// --------------------------------------------------------
// All date boundaries are computed in Asia/Kolkata (IST,
// UTC+05:30, no DST). Orders are stored as ISO-8601 UTC
// timestamps in the `placed_at` column, so every boundary
// is converted to an equivalent UTC instant before it is
// compared against the database value. This keeps "Today",
// "Yesterday", "Last 7 Days" etc. aligned with the Indian
// business day instead of the server/UTC calendar day.
// ========================================================

export const IST_TIMEZONE = 'Asia/Kolkata'
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
export const DAY_MS = 24 * 60 * 60 * 1000

// Returns the calendar date components of a Date as seen in IST.
export function toISTParts(date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  const parts = fmt.formatToParts(date)
  const out = {}
  for (const part of parts) {
    if (part.type !== 'literal') out[part.type] = part.value
  }
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second)
  }
}

// Formats a Date as "YYYY-MM-DD" in IST (safe for display/grouping keys).
export function toISTDateKey(date) {
  const { year, month, day } = toISTParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Converts a naive {year, month, day} IST calendar date into the UTC
// instant at 00:00:00 IST of that day (i.e. 5.5h behind naive UTC midnight).
export function utcStartOfISTDay(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - IST_OFFSET_MS)
}

// Returns the UTC instant of 00:00:00 IST on the IST day containing `date`.
export function startOfISTDay(date) {
  const { year, month, day } = toISTParts(date)
  return utcStartOfISTDay(year, month, day)
}

// Returns the UTC instant just before midnight of the NEXT IST day
// (i.e. start-of-day + 24h minus 1ms) — an inclusive day-end bound.
export function endOfISTDay(date) {
  return new Date(startOfISTDay(date).getTime() + DAY_MS - 1)
}

// Shifts a UTC instant by whole IST days (safe: IST has no DST).
export function shiftISTDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS)
}

// Parses "YYYY-MM-DD" into a UTC instant at 00:00:00 IST of that date.
export function parseISTDate(str) {
  if (!str) return null
  const m = String(str).trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return utcStartOfISTDay(year, month, day)
}

/**
 * Resolves a range key (plus optional custom dates) into inclusive
 * IST-aware UTC bounds.
 *
 * @param {string} range   today | yesterday | this-week | last-7-days |
 *                         last-30-days | last-90-days | last-6-months |
 *                         last-12-months | all | custom
 * @param {string} [customStart] "YYYY-MM-DD" (interpreted in IST)
 * @param {string} [customEnd]   "YYYY-MM-DD" (interpreted in IST)
 * @param {Date}   [now]         reference "now" (defaults to new Date())
 * @returns {{ start: Date|null, end: Date|null, days: number }}
 */
export function getDateRange(range, customStart, customEnd, now = new Date()) {
  const todayStart = startOfISTDay(now)
  const todayEnd = new Date(todayStart.getTime() + DAY_MS - 1)

  switch (range) {
    case 'today':
      return { start: todayStart, end: todayEnd, days: 1 }
    case 'yesterday':
      return {
        start: new Date(todayStart.getTime() - DAY_MS),
        end: new Date(todayStart.getTime() - 1),
        days: 1
      }
    case 'this-week': {
      const { year, month, day } = toISTParts(now)
      const dow = new Date(now.toLocaleString('en-US', { timeZone: IST_TIMEZONE })).getDay()
      // getDay(): 0 = Sunday. Shift so Monday = 0.
      const mondayOffset = dow === 0 ? -6 : 1 - dow
      const weekStart = shiftISTDays(todayStart, mondayOffset)
      return { start: weekStart, end: todayEnd, days: Math.max(1, Math.round((todayEnd - weekStart) / DAY_MS) + 1) }
    }
    case 'this-month': {
      const { year, month } = toISTParts(now)
      const monthStart = utcStartOfISTDay(year, month, 1)
      return { start: monthStart, end: todayEnd, days: Math.max(1, Math.round((todayEnd - monthStart) / DAY_MS) + 1) }
    }
    case 'last-7-days':
      return { start: new Date(todayStart.getTime() - 6 * DAY_MS), end: todayEnd, days: 7 }
    case 'last-30-days':
      return { start: new Date(todayStart.getTime() - 29 * DAY_MS), end: todayEnd, days: 30 }
    case 'last-90-days':
      return { start: new Date(todayStart.getTime() - 89 * DAY_MS), end: todayEnd, days: 90 }
    case 'last-6-months':
      return { start: new Date(todayStart.getTime() - 183 * DAY_MS), end: todayEnd, days: 183 }
    case 'last-12-months':
      return { start: new Date(todayStart.getTime() - 365 * DAY_MS), end: todayEnd, days: 365 }
    case 'all':
      return { start: null, end: null, days: 365 }
    case 'custom': {
      let start = todayStart
      const parsedStart = parseISTDate(customStart)
      if (parsedStart) start = parsedStart
      let end = todayEnd
      const parsedEnd = parseISTDate(customEnd)
      if (parsedEnd) end = new Date(parsedEnd.getTime() + DAY_MS - 1)
      if (start.getTime() > end.getTime()) {
        const tmp = start
        start = end
        end = new Date(tmp.getTime() + DAY_MS - 1)
      }
      return { start, end, days: Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1) }
    }
    default:
      return { start: todayStart, end: todayEnd, days: 1 }
  }
}

/**
 * Lists every IST day (start instant + "YYYY-MM-DD" key) between the
 * inclusive bounds. `end` should already be an inclusive day-end bound.
 */
export function listISTDays(start, end) {
  const days = []
  if (!start || !end) return days
  const endStart = startOfISTDay(end)
  const limit = endStart.getTime() + DAY_MS
  let cur = startOfISTDay(start)
  let guard = 0
  while (cur.getTime() < limit && guard < 400) {
    days.push({ start: cur, key: toISTDateKey(cur) })
    cur = new Date(cur.getTime() + DAY_MS)
    guard++
  }
  return days
}

/**
 * Given a stored UTC ISO timestamp, returns its IST "YYYY-MM-DD" key.
 * Used to bucket orders into the correct Indian calendar day.
 */
export function orderISTDateKey(isoTimestamp) {
  if (!isoTimestamp) return null
  const d = new Date(isoTimestamp)
  if (isNaN(d.getTime())) return null
  return toISTDateKey(d)
}
