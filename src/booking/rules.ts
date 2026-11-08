/** How many people one booking session can register. Not a game-room cap, and not shown as a public limit. */
export const BOOKING_SESSION_CAPACITY = 200

const FIVE_MINUTES = 5 * 60 * 1000
const TWO_YEARS = 366 * 2 * 24 * 60 * 60 * 1000

export type RuleError =
  | 'pin_format'
  | 'room_code'
  | 'capacity'
  | 'starts_at'
  | 'host_label'
  | 'invalid_display_name'
  | 'invalid_contact'
  | 'claim_invalid'

function hasControl(value: string) {
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code <= 31 || code === 127) return true
  }
  return false
}

export function parseHostPin(value: string): { ok: true; pin: string } | { ok: false; error: 'pin_format' } {
  const pin = value.trim()
  if (!/^[0-9]{6}$/.test(pin)) return { ok: false, error: 'pin_format' }
  return { ok: true, pin }
}

export function parseRoomCode(value: string): { ok: true; code: string | null } | { ok: false; error: 'room_code' } {
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, code: null }
  const code = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (code.length < 2 || code.length > 8) return { ok: false, error: 'room_code' }
  return { ok: true, code }
}

export function parseCapacity(value: string): { ok: true; capacity: number } | { ok: false; error: 'capacity' } {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: 'capacity' }
  const capacity = Number(trimmed)
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > BOOKING_SESSION_CAPACITY) {
    return { ok: false, error: 'capacity' }
  }
  return { ok: true, capacity }
}

export function parseStartsAt(
  value: string,
  now = Date.now(),
): { ok: true; iso: string } | { ok: false; error: 'starts_at' } {
  const trimmed = value.trim()
  if (!trimmed) return { ok: false, error: 'starts_at' }
  const time = new Date(trimmed).getTime()
  if (!Number.isFinite(time)) return { ok: false, error: 'starts_at' }
  if (time < now - FIVE_MINUTES || time > now + TWO_YEARS) return { ok: false, error: 'starts_at' }
  return { ok: true, iso: new Date(time).toISOString() }
}

export function parseHostLabel(value: string): { ok: true; label: string | null } | { ok: false; error: 'host_label' } {
  const label = value.trim()
  if (!label) return { ok: true, label: null }
  if (label.length > 32 || hasControl(label)) return { ok: false, error: 'host_label' }
  return { ok: true, label }
}

export function parseBookingName(
  value: string,
): { ok: true; name: string } | { ok: false; error: 'invalid_display_name' } {
  const name = value.trim()
  if (!name || name.length > 32 || hasControl(name)) return { ok: false, error: 'invalid_display_name' }
  return { ok: true, name }
}

export function parseContact(value: string): { ok: true; contact: string | null } | { ok: false; error: 'invalid_contact' } {
  const contact = value.trim()
  if (!contact) return { ok: true, contact: null }
  if (contact.length > 80 || hasControl(contact)) return { ok: false, error: 'invalid_contact' }
  return { ok: true, contact }
}

export function parseClaimToken(value: string): { ok: true; token: string } | { ok: false; error: 'claim_invalid' } {
  const token = value.trim().toLowerCase().replace(/\s+/g, '')
  if (!/^[0-9a-f]{32}$/.test(token)) return { ok: false, error: 'claim_invalid' }
  return { ok: true, token }
}
