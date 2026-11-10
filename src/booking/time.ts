import type { Lang } from '../i18n/text.ts'

/** Sessions are opened on the hour in Hong Kong. Hong Kong is UTC+8 all year. */
export const BOOKING_TIME_ZONE = 'Asia/Hong_Kong'
export const SLOT_MINUTES = 60
export const CALENDAR_START_HOUR = 9
export const CALENDAR_END_HOUR = 21

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export interface HktDate {
  year: number
  month: number
  day: number
}

export interface HktParts extends HktDate {
  hour: number
  minute: number
  second: number
}

function partNumber(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const value = parts.find((part) => part.type === type)?.value ?? ''
  const number = Number(value)
  return Number.isInteger(number) ? number : null
}

export function hktParts(date: Date): HktParts | null {
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-HK', {
    timeZone: BOOKING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date)
  const year = partNumber(parts, 'year')
  const month = partNumber(parts, 'month')
  const day = partNumber(parts, 'day')
  let hour = partNumber(parts, 'hour')
  const minute = partNumber(parts, 'minute')
  const second = partNumber(parts, 'second')
  if (year == null || month == null || day == null || hour == null || minute == null || second == null) return null
  if (hour === 24) hour = 0
  return { year, month, day, hour, minute, second }
}

export function hktToday(now = new Date()): HktDate {
  const parts = hktParts(now)
  if (!parts) return { year: 2026, month: 11, day: 10 }
  return { year: parts.year, month: parts.month, day: parts.day }
}

/** 19:00 in Hong Kong is 11:00 UTC. */
export function hktHourIso(year: number, month: number, day: number, hour: number) {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, 0, 0, 0)).toISOString()
}

export function addHktMonths(date: HktDate, count: number): HktDate {
  const next = new Date(Date.UTC(date.year, date.month - 1 + count, 1, 4, 0, 0))
  const year = next.getUTCFullYear()
  const month = next.getUTCMonth() + 1
  const last = new Date(Date.UTC(year, month, 0, 4, 0, 0)).getUTCDate()
  return { year, month, day: Math.min(date.day, last) }
}

export function addHktDays(date: HktDate, days: number): HktDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day, 4, 0, 0))
  next.setUTCDate(next.getUTCDate() + days)
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() }
}

export function hktWeekday(date: HktDate) {
  const probe = new Date(Date.UTC(date.year, date.month - 1, date.day, 4, 0, 0))
  const label = new Intl.DateTimeFormat('en-HK', {
    timeZone: BOOKING_TIME_ZONE,
    weekday: 'short',
  }).format(probe)
  return WEEKDAY_INDEX[label] ?? probe.getUTCDay()
}

export function startOfHktWeek(date: HktDate): HktDate {
  const weekday = hktWeekday(date)
  const delta = weekday === 0 ? -6 : 1 - weekday
  return addHktDays(date, delta)
}

export function sameHktDate(left: HktDate, right: HktDate) {
  return left.year === right.year && left.month === right.month && left.day === right.day
}

export function monthGrid(year: number, month: number) {
  const lead = startOfHktWeek({ year, month, day: 1 })
  const cells: Array<HktDate & { inMonth: boolean }> = []
  let cursor = lead
  for (let index = 0; index < 42; index += 1) {
    cells.push({ ...cursor, inMonth: cursor.year === year && cursor.month === month })
    cursor = addHktDays(cursor, 1)
  }
  return cells
}

export function visibleRange(view: 'week' | 'month', anchor: HktDate) {
  if (view === 'week') {
    const start = startOfHktWeek(anchor)
    const end = addHktDays(start, 7)
    return {
      start,
      end,
      from: hktHourIso(start.year, start.month, start.day, 0),
      to: hktHourIso(end.year, end.month, end.day, 0),
    }
  }
  const cells = monthGrid(anchor.year, anchor.month)
  const start = cells[0]
  const end = addHktDays(cells[cells.length - 1], 1)
  return {
    start,
    end,
    from: hktHourIso(start.year, start.month, start.day, 0),
    to: hktHourIso(end.year, end.month, end.day, 0),
  }
}

export function isHktHour(iso: string) {
  const date = new Date(iso)
  const parts = hktParts(date)
  if (!parts || parts.minute !== 0 || parts.second !== 0) return false
  return date.getTime() % 1000 === 0
}

const FIVE_MINUTES = 5 * 60 * 1000
const TWO_YEARS = 366 * 2 * 24 * 60 * 60 * 1000

export function parseSlotStart(
  value: string,
  now = Date.now(),
): { ok: true; iso: string } | { ok: false; error: 'starts_at' | 'slot_hour' } {
  const trimmed = value.trim()
  const time = new Date(trimmed).getTime()
  if (!trimmed || !Number.isFinite(time)) return { ok: false, error: 'starts_at' }
  if (time < now - FIVE_MINUTES || time > now + TWO_YEARS) return { ok: false, error: 'starts_at' }
  if (!isHktHour(new Date(time).toISOString())) return { ok: false, error: 'slot_hour' }
  return { ok: true, iso: new Date(time).toISOString() }
}

export function rangesOverlap(leftMs: number, rightMs: number, minutes = SLOT_MINUTES) {
  const span = minutes * 60 * 1000
  return leftMs < rightMs + span && rightMs < leftMs + span
}

export function formatHourRange(hour: number) {
  const end = (hour + 1) % 24
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(hour)}:00–${pad(end)}:00`
}

export function formatHktDay(date: HktDate, lang: Lang) {
  const probe = new Date(Date.UTC(date.year, date.month - 1, date.day, 4, 0, 0))
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-HK' : 'zh-HK', {
    timeZone: BOOKING_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(probe)
}

export function formatHktMonth(date: HktDate, lang: Lang) {
  const probe = new Date(Date.UTC(date.year, date.month - 1, date.day, 4, 0, 0))
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-HK' : 'zh-HK', {
    timeZone: BOOKING_TIME_ZONE,
    year: 'numeric',
    month: 'long',
  }).format(probe)
}
