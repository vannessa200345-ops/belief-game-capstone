import { bookingMessage } from './messages.ts'
import {
  parseBookingName,
  parseCapacity,
  parseClaimToken,
  parseContact,
  parseHostLabel,
  parseHostPin,
  parseRoomCode,
  parseStartsAt,
} from './rules.ts'
import type { BookingApi, BookingBoard, Fail, PublicSlot, PublicTeacher, SlotBooking } from './types.ts'

const KEY = 'belief-booking-v1'
const TWELVE_HOURS = 12 * 60 * 60 * 1000

interface StoredSlot {
  id: string
  kind: 'group' | 'one_on_one'
  startsAt: string
  capacity: number
  hostLabel: string | null
  teacherId: string | null
  roomCode: string | null
  status: 'open' | 'full' | 'cancelled' | 'started'
}

interface StoredBooking {
  id: string
  slotId: string
  name: string
  contact: string | null
  teacherId: string | null
  status: 'confirmed' | 'cancelled'
  createdAt: string
}

interface StoredCred {
  roomCode: string
  pinHash: string
  slotId: string | null
}

interface StoredClaim {
  slotId: string
  roomCode: string | null
  tokenHash: string
  claimed: boolean
  expiresAt: number
}

interface MockState {
  slots: StoredSlot[]
  bookings: StoredBooking[]
  credentials: StoredCred[]
  claims: StoredClaim[]
}

const teachers: Array<PublicTeacher & { bookable: boolean }> = [
  {
    id: 'teacher-andy',
    slug: 'andy',
    name: 'Andy',
    summary: '小組場次之後，可以預約一對一對話。',
    summaryEn: 'After a group session, you can book a one-on-one conversation.',
    bookable: true,
  },
  {
    id: 'teacher-vanessa',
    slug: 'vanessa',
    name: 'Vanessa',
    summary: '暫未開放預約。',
    summaryEn: 'Not open for booking yet.',
    bookable: false,
  },
]

function emptyState(): MockState {
  return { slots: [], bookings: [], credentials: [], claims: [] }
}

function load(): MockState {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<MockState>
    return {
      slots: Array.isArray(parsed.slots) ? parsed.slots : [],
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
      credentials: Array.isArray(parsed.credentials) ? parsed.credentials : [],
      claims: Array.isArray(parsed.claims) ? parsed.claims : [],
    }
  } catch {
    return emptyState()
  }
}

function save(state: MockState) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* 預覽仍可用這一頁的記憶。 */
  }
}

function fail(code: string): Fail {
  return { ok: false, error: bookingMessage(code) }
}

async function digestHex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const buf = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(buf)].map((item) => item.toString(16).padStart(2, '0')).join('')
}

function confirmedFor(state: MockState, slotId: string) {
  return state.bookings.filter((booking) => booking.slotId === slotId && booking.status === 'confirmed')
}

function toPublic(state: MockState, slot: StoredSlot): PublicSlot {
  return {
    id: slot.id,
    kind: 'group',
    startsAt: slot.startsAt,
    capacity: slot.capacity,
    bookedCount: confirmedFor(state, slot.id).length,
    hostLabel: slot.hostLabel,
    roomCode: slot.roomCode,
    status: slot.status === 'cancelled' ? 'open' : slot.status,
  }
}

function visible(slot: StoredSlot, now: number) {
  return slot.kind === 'group' && slot.status !== 'cancelled' && new Date(slot.startsAt).getTime() > now - TWELVE_HOURS
}

async function acceptProof(state: MockState, pin: string, roomCode: string | null) {
  const parsed = parseHostPin(pin)
  if (!parsed.ok) return fail(parsed.error)
  if (roomCode) {
    const cred = state.credentials.find((item) => item.roomCode === roomCode)
    if (cred) {
      const hash = await digestHex(parsed.pin)
      if (hash !== cred.pinHash) return fail('pin_rejected')
      return { ok: true as const, scope: 'session' as const, pin: parsed.pin }
    }
  }
  return { ok: true as const, scope: 'preview' as const, pin: parsed.pin }
}

function canManage(scope: 'session' | 'preview', slot: StoredSlot, roomCode: string | null) {
  if (scope === 'preview') return true
  return Boolean(slot.roomCode && roomCode && slot.roomCode === roomCode)
}

function sameMinute(left: string, right: string) {
  return Math.floor(new Date(left).getTime() / 60000) === Math.floor(new Date(right).getTime() / 60000)
}

function boardOf(state: MockState): BookingBoard {
  const now = Date.now()
  return {
    teachers: teachers
      .map((teacher) => ({
        id: teacher.id,
        slug: teacher.slug,
        name: teacher.name,
        summary: teacher.summary,
        summaryEn: teacher.summaryEn,
        bookable: teacher.bookable,
      }))
      .sort((a, b) => Number(b.bookable) - Number(a.bookable) || a.name.localeCompare(b.name)),
    slots: state.slots
      .filter((slot) => visible(slot, now))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((slot) => toPublic(state, slot)),
  }
}

export const mockBooking: BookingApi = {
  async verifyHostPin(input) {
    const code = parseRoomCode(input.roomCode ?? '')
    if (!code.ok) return fail(code.error)
    const proof = await acceptProof(load(), input.pin, code.code)
    if (!proof.ok) return proof
    return { ok: true, scope: proof.scope }
  },

  async createSlot(input) {
    const code = parseRoomCode(input.roomCode ?? '')
    const when = parseStartsAt(input.startsAt)
    const capacity = parseCapacity(String(input.capacity))
    const label = parseHostLabel(input.hostLabel ?? '')
    if (!code.ok) return fail(code.error)
    if (!when.ok) return fail(when.error)
    if (!capacity.ok) return fail(capacity.error)
    if (!label.ok) return fail(label.error)
    const state = load()
    const proof = await acceptProof(state, input.proofPin, code.code)
    if (!proof.ok) return proof
    const slot: StoredSlot = {
      id: crypto.randomUUID(),
      kind: 'group',
      startsAt: when.iso,
      capacity: capacity.capacity,
      hostLabel: label.label,
      teacherId: null,
      roomCode: code.code,
      status: 'open',
    }
    const token = [...crypto.getRandomValues(new Uint8Array(16))].map((item) => item.toString(16).padStart(2, '0')).join('')
    state.slots.push(slot)
    state.claims.push({
      slotId: slot.id,
      roomCode: code.code,
      tokenHash: await digestHex(token),
      claimed: false,
      expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
    })
    save(state)
    return { ok: true, slot: toPublic(state, slot), claimToken: token }
  },

  async issueClaim(input) {
    const code = parseRoomCode(input.roomCode ?? '')
    if (!code.ok) return fail(code.error)
    const state = load()
    const slot = state.slots.find((item) => item.id === input.slotId && item.kind === 'group' && item.status !== 'cancelled')
    if (!slot) return fail('slot_not_found')
    const proof = await acceptProof(state, input.proofPin, code.code ?? slot.roomCode)
    if (!proof.ok) return proof
    if (!canManage(proof.scope, slot, code.code ?? slot.roomCode)) return fail('forbidden')
    for (const claim of state.claims) {
      if (claim.slotId === slot.id && !claim.claimed) claim.expiresAt = Date.now()
    }
    const token = [...crypto.getRandomValues(new Uint8Array(16))].map((item) => item.toString(16).padStart(2, '0')).join('')
    state.claims.push({
      slotId: slot.id,
      roomCode: slot.roomCode,
      tokenHash: await digestHex(token),
      claimed: false,
      expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
    })
    save(state)
    return { ok: true, claimToken: token }
  },

  async claimSessionPin(input) {
    const token = parseClaimToken(input.claimToken)
    const code = parseRoomCode(input.roomCode)
    const pin = parseHostPin(input.newPin)
    if (!token.ok) return fail(token.error)
    if (!code.ok || !code.code) return fail('room_code')
    if (!pin.ok) return fail(pin.error)
    const state = load()
    const hash = await digestHex(token.token)
    const claim = state.claims.find((item) => item.tokenHash === hash && !item.claimed && item.expiresAt > Date.now())
    if (!claim) return fail('claim_invalid')
    if (claim.roomCode && claim.roomCode !== code.code) return fail('room_code')
    const slot = state.slots.find((item) => item.id === claim.slotId)
    if (!slot || slot.status === 'cancelled') return fail('slot_not_found')
    if (slot.roomCode && slot.roomCode !== code.code) return fail('room_code')
    claim.claimed = true
    const pinHash = await digestHex(pin.pin)
    state.credentials = state.credentials.filter((item) => item.roomCode !== code.code)
    state.credentials.push({ roomCode: code.code, pinHash, slotId: slot.id })
    if (!slot.roomCode) slot.roomCode = code.code
    save(state)
    return { ok: true }
  },

  async setSessionPin(input) {
    const code = parseRoomCode(input.roomCode)
    const pin = parseHostPin(input.newPin)
    if (!code.ok || !code.code) return fail('room_code')
    if (!pin.ok) return fail(pin.error)
    const state = load()
    const proof = await acceptProof(state, input.proofPin, code.code)
    if (!proof.ok) return proof
    const pinHash = await digestHex(pin.pin)
    state.credentials = state.credentials.filter((item) => item.roomCode !== code.code)
    state.credentials.push({ roomCode: code.code, pinHash, slotId: null })
    save(state)
    return { ok: true }
  },

  async attachRoom(input) {
    const code = parseRoomCode(input.roomCode)
    if (!code.ok || !code.code) return fail('room_code')
    const state = load()
    const slot = state.slots.find((item) => item.id === input.slotId && item.kind === 'group' && item.status !== 'cancelled')
    if (!slot) return fail('slot_not_found')
    const proof = await acceptProof(state, input.proofPin, code.code)
    if (!proof.ok) return proof
    if (proof.scope === 'session' && slot.roomCode && slot.roomCode !== code.code) return fail('forbidden')
    slot.roomCode = code.code
    save(state)
    return { ok: true, slot: toPublic(state, slot) }
  },

  async cancelSlot(input) {
    const code = parseRoomCode(input.roomCode ?? '')
    if (!code.ok) return fail(code.error)
    const state = load()
    const slot = state.slots.find((item) => item.id === input.slotId && item.status !== 'cancelled')
    if (!slot) return fail('slot_not_found')
    const roomCode = code.code ?? slot.roomCode
    const proof = await acceptProof(state, input.proofPin, roomCode)
    if (!proof.ok) return proof
    if (!canManage(proof.scope, slot, roomCode)) return fail('forbidden')
    slot.status = 'cancelled'
    save(state)
    return { ok: true }
  },

  async listBoard() {
    return { ok: true, board: boardOf(load()) }
  },

  async listBookings(input) {
    const code = parseRoomCode(input.roomCode ?? '')
    if (!code.ok) return fail(code.error)
    const state = load()
    const slot = state.slots.find((item) => item.id === input.slotId)
    if (!slot) return fail('slot_not_found')
    const roomCode = code.code ?? slot.roomCode
    const proof = await acceptProof(state, input.proofPin, roomCode)
    if (!proof.ok) return proof
    if (!canManage(proof.scope, slot, roomCode)) return fail('forbidden')
    const bookings: SlotBooking[] = confirmedFor(state, slot.id).map((booking) => ({
      name: booking.name,
      contact: booking.contact,
      createdAt: booking.createdAt,
    }))
    return { ok: true, bookings }
  },

  async joinSlot(input) {
    const name = parseBookingName(input.name)
    const contact = parseContact(input.contact ?? '')
    if (!name.ok) return fail(name.error)
    if (!contact.ok) return fail(contact.error)
    const state = load()
    const slot = state.slots.find((item) => item.id === input.slotId && item.kind === 'group')
    if (!slot) return fail('slot_not_found')
    if (slot.status === 'full') return fail('slot_full')
    if (slot.status !== 'open' || new Date(slot.startsAt).getTime() < Date.now() - TWELVE_HOURS) return fail('slot_closed')
    const rows = confirmedFor(state, slot.id)
    if (rows.some((booking) => booking.name.toLowerCase() === name.name.toLowerCase())) {
      return { ok: true, already: true }
    }
    if (rows.length >= slot.capacity) {
      slot.status = 'full'
      save(state)
      return fail('slot_full')
    }
    state.bookings.push({
      id: crypto.randomUUID(),
      slotId: slot.id,
      name: name.name,
      contact: contact.contact,
      teacherId: slot.teacherId,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    })
    if (rows.length + 1 >= slot.capacity) slot.status = 'full'
    save(state)
    return { ok: true, already: false }
  },

  async bookOneOnOne(input) {
    const name = parseBookingName(input.name)
    const contact = parseContact(input.contact ?? '')
    const when = parseStartsAt(input.startsAt)
    if (!name.ok) return fail(name.error)
    if (!contact.ok) return fail(contact.error)
    if (!when.ok) return fail(when.error)
    const teacher = teachers.find((item) => item.id === input.teacherId)
    if (!teacher || !teacher.bookable) return fail('teacher_unavailable')
    const state = load()
    const taken = state.slots.some(
      (slot) =>
        slot.teacherId === teacher.id &&
        slot.kind === 'one_on_one' &&
        slot.status !== 'cancelled' &&
        sameMinute(slot.startsAt, when.iso),
    )
    if (taken) return fail('slot_taken')
    const slotId = crypto.randomUUID()
    state.slots.push({
      id: slotId,
      kind: 'one_on_one',
      startsAt: when.iso,
      capacity: 1,
      hostLabel: teacher.name,
      teacherId: teacher.id,
      roomCode: null,
      status: 'full',
    })
    state.bookings.push({
      id: crypto.randomUUID(),
      slotId,
      name: name.name,
      contact: contact.contact,
      teacherId: teacher.id,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    })
    save(state)
    return { ok: true }
  },
}
