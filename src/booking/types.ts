export interface PublicTeacher {
  id: string
  slug: string
  name: string
  summary: string
  summaryEn: string
  bookable: boolean
}

export type SlotKind = 'group' | 'one_on_one'

export interface PublicSlot {
  id: string
  kind: SlotKind
  startsAt: string
  capacity: number
  bookedCount: number
  hostLabel: string | null
  teacherId: string | null
  roomCode: string | null
  status: 'open' | 'full' | 'started'
}

export interface TeacherAccount {
  id: string
  slug: string
  name: string
  role: 'teacher' | 'operator'
  bookable: boolean
}

export interface TeacherDirectoryEntry {
  id: string
  slug: string
  name: string
  bookable: boolean
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
    slotId: string
    name: string
    contact: string | null
  }): Promise<{ ok: true; already: boolean } | Fail>
  teacherMe(): Promise<{ ok: true; teacher: TeacherAccount; directory: TeacherDirectoryEntry[] } | Fail>
  teacherListSlots(input: {
    kind: SlotKind
    from: string
    to: string
  }): Promise<{ ok: true; slots: PublicSlot[] } | Fail>
  teacherOpenSlot(input: { kind: SlotKind; startsAt: string }): Promise<{ ok: true; slot: PublicSlot } | Fail>
  teacherCloseSlot(input: { slotId: string }): Promise<{ ok: true } | Fail>
  teacherListBookings(input: { slotId: string }): Promise<{ ok: true; bookings: SlotBooking[] } | Fail>
  /** Local preview only. The live backend rejects this. */
  teacherPreview(input: { role: 'teacher' | 'operator' }): Promise<{ ok: true } | Fail>
  teacherSignOut(): Promise<{ ok: true }>
}
