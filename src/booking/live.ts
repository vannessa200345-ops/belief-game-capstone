import { ensureAnonymousSession, getSupabase } from '../lib/supabase.ts'
import { bookingMessage } from './messages.ts'
import type { BookingApi, BookingBoard, Fail, PublicSlot, PublicTeacher, SlotBooking } from './types.ts'

function errorText(error: unknown) {
  if (typeof error === 'object' && error) {
    const record = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown }
    return `${String(record.code ?? '')} ${String(record.message ?? '')} ${String(record.details ?? '')} ${String(record.hint ?? '')}`
  }
  return error instanceof Error ? error.message : ''
}

function thrownMessage(error: unknown) {
  const text = errorText(error)
  if (text.includes('PGRST202') || text.includes('Could not find the function') || text.includes('schema cache')) {
    return bookingMessage('migration_missing')
  }
  if (text.includes('Failed to fetch') || text.includes('NetworkError') || text.includes('網絡')) {
    return bookingMessage('network')
  }
  return bookingMessage('unknown')
}

function fail(code: string): Fail {
  return { ok: false, error: bookingMessage(code) }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

async function call(fn: string, args: Record<string, unknown>): Promise<{ ok: true; data: unknown } | Fail> {
  try {
    await ensureAnonymousSession()
    const { data, error } = await getSupabase().rpc(fn, args)
    if (error) return { ok: false, error: thrownMessage(error) }
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error: thrownMessage(error) }
  }
}

function payloadError(data: unknown): Fail | null {
  const record = asRecord(data)
  if (!record) return fail('unknown')
  if (record.ok === false) return fail(typeof record.error === 'string' ? record.error : 'unknown')
  if (record.ok !== true) return fail('unknown')
  return null
}

function readTeacher(value: unknown): PublicTeacher | null {
  const row = asRecord(value)
  if (!row) return null
  if (typeof row.id !== 'string' || typeof row.slug !== 'string' || typeof row.name !== 'string') return null
  if (typeof row.summary !== 'string' || typeof row.summaryEn !== 'string') return null
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    summaryEn: row.summaryEn,
    bookable: row.bookable !== false,
  }
}

function readSlot(value: unknown): PublicSlot | null {
  const row = asRecord(value)
  if (!row || row.kind !== 'group' || typeof row.id !== 'string' || typeof row.startsAt !== 'string') return null
  const capacity = Number(row.capacity)
  const bookedCount = Number(row.bookedCount)
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 30) return null
  if (!Number.isInteger(bookedCount) || bookedCount < 0) return null
  if (row.status !== 'open' && row.status !== 'full' && row.status !== 'started') return null
  if (row.hostLabel != null && typeof row.hostLabel !== 'string') return null
  if (row.roomCode != null && typeof row.roomCode !== 'string') return null
  return {
    id: row.id,
    kind: 'group',
    startsAt: row.startsAt,
    capacity,
    bookedCount,
    hostLabel: typeof row.hostLabel === 'string' ? row.hostLabel : null,
    roomCode: typeof row.roomCode === 'string' ? row.roomCode : null,
    status: row.status,
  }
}

function readBoard(value: unknown): BookingBoard | null {
  const record = asRecord(value)
  if (!record || !Array.isArray(record.teachers) || !Array.isArray(record.slots)) return null
  return {
    teachers: record.teachers.map(readTeacher).filter((teacher): teacher is PublicTeacher => teacher != null),
    slots: record.slots.map(readSlot).filter((slot): slot is PublicSlot => slot != null),
  }
}

function readBookings(value: unknown): SlotBooking[] | null {
  if (!Array.isArray(value)) return null
  const bookings: SlotBooking[] = []
  for (const item of value) {
    const row = asRecord(item)
    if (!row || typeof row.name !== 'string' || typeof row.createdAt !== 'string') return null
    if (row.contact != null && typeof row.contact !== 'string') return null
    bookings.push({
      name: row.name,
      contact: typeof row.contact === 'string' ? row.contact : null,
      createdAt: row.createdAt,
    })
  }
  return bookings
}

export const liveBooking: BookingApi = {
  async verifyHostPin(input) {
    const called = await call('verify_host_pin', { p_pin: input.pin, p_room_code: input.roomCode })
    if (!called.ok) return called
    const problem = payloadError(called.data)
    if (problem) return problem
    const scope = asRecord(called.data)?.scope
    if (scope !== 'operator' && scope !== 'session') return fail('pin_rejected')
    return { ok: true, scope }
  },

  async createSlot(input) {
    const called = await call('create_booking_slot', {
      p_proof_pin: input.proofPin,
      p_starts_at: input.startsAt,
      p_capacity: input.capacity,
      p_host_label: input.hostLabel,
      p_room_code: input.roomCode,
    })
    if (!called.ok) return called
    const problem = payloadError(called.data)
    if (problem) return problem
    const record = asRecord(called.data)
    const slot = readSlot(record?.slot)
    const claimToken = typeof record?.claimToken === 'string' ? record.claimToken : ''
    if (!slot || !/^[0-9a-f]{32}$/.test(claimToken)) return fail('unknown')
    return { ok: true, slot, claimToken }
  },

  async issueClaim(input) {
    const called = await call('issue_slot_claim', {
      p_slot_id: input.slotId,
      p_proof_pin: input.proofPin,
      p_room_code: input.roomCode,
    })
    if (!called.ok) return called
    const problem = payloadError(called.data)
    if (problem) return problem
    const claimToken = asRecord(called.data)?.claimToken
    if (typeof claimToken !== 'string' || !/^[0-9a-f]{32}$/.test(claimToken)) return fail('unknown')
    return { ok: true, claimToken }
  },

  async claimSessionPin(input) {
    const called = await call('claim_session_host_pin', {
      p_claim_token: input.claimToken,
      p_room_code: input.roomCode,
      p_new_pin: input.newPin,
    })
    if (!called.ok) return called
    return payloadError(called.data) ?? { ok: true }
  },

  async setSessionPin(input) {
    const called = await call('set_session_host_pin', {
      p_room_code: input.roomCode,
      p_new_pin: input.newPin,
      p_proof_pin: input.proofPin,
    })
    if (!called.ok) return called
    return payloadError(called.data) ?? { ok: true }
  },

  async attachRoom(input) {
    const called = await call('attach_slot_room', {
      p_slot_id: input.slotId,
      p_room_code: input.roomCode,
      p_proof_pin: input.proofPin,
    })
    if (!called.ok) return called
    const problem = payloadError(called.data)
    if (problem) return problem
    const slot = readSlot(asRecord(called.data)?.slot)
    if (!slot) return fail('unknown')
    return { ok: true, slot }
  },

  async cancelSlot(input) {
    const called = await call('cancel_booking_slot', {
      p_slot_id: input.slotId,
      p_proof_pin: input.proofPin,
      p_room_code: input.roomCode,
    })
    if (!called.ok) return called
    return payloadError(called.data) ?? { ok: true }
  },

  async listBoard() {
    const called = await call('list_booking_board', {})
    if (!called.ok) return called
    const board = readBoard(called.data)
    if (!board) return fail('unknown')
    return { ok: true, board }
  },

  async listBookings(input) {
    const called = await call('list_slot_bookings', {
      p_slot_id: input.slotId,
      p_proof_pin: input.proofPin,
      p_room_code: input.roomCode,
    })
    if (!called.ok) return called
    const problem = payloadError(called.data)
    if (problem) return problem
    const bookings = readBookings(asRecord(called.data)?.bookings)
    if (!bookings) return fail('unknown')
    return { ok: true, bookings }
  },

  async joinSlot(input) {
    const called = await call('join_booking_slot', {
      p_slot_id: input.slotId,
      p_display_name: input.name,
      p_contact: input.contact,
    })
    if (!called.ok) return called
    const problem = payloadError(called.data)
    if (problem) return problem
    return { ok: true, already: asRecord(called.data)?.already === true }
  },

  async bookOneOnOne(input) {
    const called = await call('book_one_on_one', {
      p_teacher_id: input.teacherId,
      p_starts_at: input.startsAt,
      p_display_name: input.name,
      p_contact: input.contact,
    })
    if (!called.ok) return called
    return payloadError(called.data) ?? { ok: true }
  },
}
