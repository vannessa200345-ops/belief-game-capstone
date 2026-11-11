/** 一次 not_member／not_in_room 可以係重新接上時的競賽，唔好立刻忘掉仍有效的座位。 */
export const TRANSIENT_MEMBERSHIP_LIMIT = 3

export type LobbyFault = 'room_not_found' | 'membership' | 'other'

export function lobbyErrorText(error: unknown): string {
  if (typeof error === 'string') return error
  if (!error || typeof error !== 'object') return error instanceof Error ? error.message : ''
  const record = error as { message?: unknown; hint?: unknown; details?: unknown; code?: unknown }
  const text = [record.message, record.hint, record.details, record.code]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
  if (text) return text
  return error instanceof Error ? error.message : ''
}

export function classifyLobbyFault(text: string): LobbyFault {
  if (text.includes('room_not_found')) return 'room_not_found'
  if (text.includes('not_member') || text.includes('not_in_room')) return 'membership'
  return 'other'
}

export interface SeatDecision {
  seat: string | null
  misses: number
  retry: boolean
}

export function seatAfterFault(seat: string | null, text: string, misses: number): SeatDecision {
  if (!seat) return { seat: null, misses, retry: false }
  const fault = classifyLobbyFault(text)
  if (fault === 'room_not_found') return { seat: null, misses: 0, retry: false }
  if (fault === 'membership') {
    const next = misses + 1
    if (next >= TRANSIENT_MEMBERSHIP_LIMIT) return { seat: null, misses: 0, retry: false }
    return { seat, misses: next, retry: true }
  }
  return { seat, misses, retry: false }
}

/** 這一頁已經睇緊場，結束時留低總結。重新打開一個已結束的房間，學員回到加入頁。主持台重新整理仍可睇這一場。 */
export function shouldForgetEndedRoom(input: {
  status: string
  endedAt: string | null | undefined
  sawLiveLobby: boolean
  hostDesk?: boolean
}): boolean {
  const ended = input.status === 'ended' || (input.endedAt != null && input.endedAt !== '')
  if (!ended || input.sawLiveLobby || input.hostDesk) return false
  return true
}

export function pathIsHostDesk(pathname: string): boolean {
  return pathname.includes('/host/') || pathname.endsWith('/host')
}
