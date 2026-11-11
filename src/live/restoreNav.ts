import type { Connection, Phase } from '../domain/types.ts'

export function phasePath(phase: Phase, paceDone: boolean): string {
  if (phase === 'lobby') return '/play/lobby'
  if (phase === 'final' || paceDone) return '/play/final'
  return '/play'
}

export interface RestoreNavInput {
  pathname: string
  invite: boolean
  connection: Connection
  hasYou: boolean
  phase: Phase
  paceDone: boolean
  pendingRoom: boolean
  hostUnlocked: boolean
  lastPath: string | null
  roomCode: string
}

/** 返回下一個路徑。null 代表留喺而家這一頁。 */
export function restoreNavigation(input: RestoreNavInput): string | null {
  if (!input.hasYou && (input.connection === 'connecting' || input.pendingRoom)) return null

  if (input.pathname === '/' && !input.invite) {
    if (input.hostUnlocked && isHostSurface(input.lastPath)) return input.lastPath
    if (input.hasYou) return different(input.pathname, phasePath(input.phase, input.paceDone))
    return null
  }

  const onPlayer = input.pathname === '/' || input.pathname.startsWith('/play') || input.invite
  if (!onPlayer) return null

  if (input.invite && input.roomCode && input.pathname.toUpperCase() !== `/R/${input.roomCode.toUpperCase()}`) {
    return null
  }

  if (!input.hasYou) {
    if (input.invite || input.pathname === '/') return null
    return '/'
  }

  return different(input.pathname, phasePath(input.phase, input.paceDone))
}

function different(pathname: string, target: string): string | null {
  return pathname === target ? null : target
}

function isHostSurface(path: string | null): path is string {
  return Boolean(path && path.startsWith('/host') && !path.includes('?') && !path.includes('#') && !path.includes('://'))
}

/** 只記路徑。查詢字串同雜湊會被拆走，密碼唔可以跟住網址走。 */
export function surfaceToRemember(pathname: string, hostUnlocked: boolean): string | null {
  const path = pathname.split('?')[0]?.split('#')[0] ?? ''
  if (!path.startsWith('/') || path.includes('://')) return null
  if (path.startsWith('/play')) return path
  if (hostUnlocked && path.startsWith('/host')) return path
  return null
}
