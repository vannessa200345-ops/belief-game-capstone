export interface PublicTeacher {
  id: string
  slug: string
  name: string
  summary: string
  summaryEn: string
}

export interface PublicSlot {
  id: string
  kind: 'group'
  startsAt: string
  capacity: number
  bookedCount: number
  hostLabel: string | null
  roomCode: string | null
  status: 'open' | 'full' | 'started'
}

export interface BookingBoard {
  teachers: PublicTeacher[]
  slots: PublicSlot[]
}

export interface SlotBooking {
  name: string
  contact: string | null
  createdAt: string
}

export type HostScope = 'operator' | 'session' | 'preview'

export type Fail = { ok: false; error: string }

export interface BookingApi {
  verifyHostPin(input: { pin: string; roomCode: string | null }): Promise<{ ok: true; scope: HostScope } | Fail>
  createSlot(input: {
    proofPin: string
    startsAt: string
    capacity: number
    hostLabel: string | null
    roomCode: string | null
  }): Promise<{ ok: true; slot: PublicSlot; claimToken: string } | Fail>
  issueClaim(input: {
    slotId: string
    proofPin: string
    roomCode: string | null
  }): Promise<{ ok: true; claimToken: string } | Fail>
  claimSessionPin(input: { claimToken: string; roomCode: string; newPin: string }): Promise<{ ok: true } | Fail>
  setSessionPin(input: { roomCode: string; newPin: string; proofPin: string }): Promise<{ ok: true } | Fail>
  attachRoom(input: {
    slotId: string
    roomCode: string
    proofPin: string
  }): Promise<{ ok: true; slot: PublicSlot } | Fail>
  cancelSlot(input: { slotId: string; proofPin: string; roomCode: string | null }): Promise<{ ok: true } | Fail>
  listBoard(): Promise<{ ok: true; board: BookingBoard } | Fail>
  listBookings(input: {
    slotId: string
    proofPin: string
    roomCode: string | null
  }): Promise<{ ok: true; bookings: SlotBooking[] } | Fail>
  joinSlot(input: {
    slotId: string
    name: string
    contact: string | null
  }): Promise<{ ok: true; already: boolean } | Fail>
  bookOneOnOne(input: {
    teacherId: string
    startsAt: string
    name: string
    contact: string | null
  }): Promise<{ ok: true } | Fail>
}
