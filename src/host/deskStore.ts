import type { HostScope } from '../booking/types.ts'
import {
  browserLocal,
  browserSession,
  readDurable,
  removeDurable,
  writeDurable,
  type Kv,
} from '../lib/durableKv.ts'

/**
 * 主持台解鎖寫喺這部瀏覽器的 localStorage，電話打完或者分頁被收起之後可以回到同一頁。
 * 場次安排的 RPC 要帶返已經核對過的六位密碼，所以密碼要一併留下。
 * 唔好寫入網址，唔好寫入 log。按「鎖定主持台」，或者距上次解鎖超過十二小時，就刪掉。
 */
export const HOST_DESK_KEY = 'belief-host-desk'
export const HOST_SURFACE_KEY = 'belief-last-surface'
export const HOST_DESK_TTL_MS = 12 * 60 * 60 * 1000

export interface DeskSession {
  scope: HostScope
  roomCode: string | null
  proofPin: string
}

interface DeskEnvelope {
  v: 1
  scope: HostScope
  roomCode: string | null
  proofPin: string
  unlockedAt: number
}

function isScope(value: unknown): value is HostScope {
  return value === 'operator' || value === 'session' || value === 'preview'
}

export function loadHostDesk(local: Kv, session: Kv, now = Date.now()): DeskSession | null {
  const raw = readDurable(local, session, HOST_DESK_KEY)
  if (!raw) return null
  const drop = () => {
    removeDurable(local, session, HOST_DESK_KEY)
    return null
  }
  try {
    const parsed = JSON.parse(raw) as Partial<DeskEnvelope>
    if (parsed.v !== 1) return drop()
    if (!isScope(parsed.scope)) return drop()
    if (typeof parsed.proofPin !== 'string' || !/^\d{6}$/.test(parsed.proofPin)) return drop()
    if (!(parsed.roomCode == null || (typeof parsed.roomCode === 'string' && /^[A-Z0-9]{2,8}$/.test(parsed.roomCode)))) {
      return drop()
    }
    if (typeof parsed.unlockedAt !== 'number' || now - parsed.unlockedAt > HOST_DESK_TTL_MS) return drop()
    return { scope: parsed.scope, roomCode: parsed.roomCode ?? null, proofPin: parsed.proofPin }
  } catch {
    return drop()
  }
}

export function saveHostDesk(local: Kv, session: Kv, value: DeskSession | null, now = Date.now()) {
  if (!value) {
    removeDurable(local, session, HOST_DESK_KEY)
    return
  }
  const envelope: DeskEnvelope = {
    v: 1,
    scope: value.scope,
    roomCode: value.roomCode,
    proofPin: value.proofPin,
    unlockedAt: now,
  }
  writeDurable(local, session, HOST_DESK_KEY, JSON.stringify(envelope))
}

export function loadSurface(local: Kv, session: Kv): string | null {
  const raw = readDurable(local, session, HOST_SURFACE_KEY)
  if (!raw || (!raw.startsWith('/host') && !raw.startsWith('/play'))) return null
  if (raw.includes('?') || raw.includes('#') || raw.includes('://')) return null
  return raw
}

export function saveSurface(local: Kv, session: Kv, path: string | null) {
  if (!path) {
    removeDurable(local, session, HOST_SURFACE_KEY)
    return
  }
  writeDurable(local, session, HOST_SURFACE_KEY, path)
}

export function loadHostDeskBrowser(now = Date.now()) {
  return loadHostDesk(browserLocal(), browserSession(), now)
}

export function saveHostDeskBrowser(value: DeskSession | null, now = Date.now()) {
  saveHostDesk(browserLocal(), browserSession(), value, now)
}

export function loadSurfaceBrowser() {
  return loadSurface(browserLocal(), browserSession())
}

export function saveSurfaceBrowser(path: string | null) {
  saveSurface(browserLocal(), browserSession(), path)
}
