import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { HOST_DESK_KEY, HOST_DESK_TTL_MS, loadHostDesk, saveHostDesk, saveSurface } from '../host/deskStore.ts'
import { memoryKv, readDurable, writeDurable } from '../lib/durableKv.ts'
import { lobbyErrorText, pathIsHostDesk, seatAfterFault, shouldForgetEndedRoom, TRANSIENT_MEMBERSHIP_LIMIT } from './membership.ts'
import { phasePath, restoreNavigation, surfaceToRemember, type RestoreNavInput } from './restoreNav.ts'

const ROOM_KEY = 'belief-live-room'

function nav(overrides: Partial<RestoreNavInput> = {}): RestoreNavInput {
  return {
    pathname: '/play',
    invite: false,
    connection: 'live',
    hasYou: true,
    phase: 'playing',
    paceDone: false,
    pendingRoom: false,
    hostUnlocked: false,
    lastPath: '/play',
    roomCode: 'AB12',
    ...overrides,
  }
}

describe('room seat survives reload and tab discard', () => {
  it('keeps a joined room when session storage is wiped', () => {
    const local = memoryKv()
    const session = memoryKv()
    writeDurable(local, session, ROOM_KEY, 'room-1')
    const discardedSession = memoryKv()
    assert.equal(readDurable(local, discardedSession, ROOM_KEY), 'room-1')
    assert.equal(session.getItem(ROOM_KEY), null)
  })

  it('migrates a room id out of session storage before the tab can be discarded', () => {
    const local = memoryKv()
    const session = memoryKv({ [ROOM_KEY]: 'room-1' })
    assert.equal(readDurable(local, session, ROOM_KEY), 'room-1')
    assert.equal(local.getItem(ROOM_KEY), 'room-1')
    assert.equal(session.getItem(ROOM_KEY), null)
    assert.equal(readDurable(local, memoryKv(), ROOM_KEY), 'room-1')
  })

  it('keeps self-pace progress across the same discard', () => {
    const local = memoryKv()
    const session = memoryKv()
    writeDurable(local, session, 'belief-self-pace', JSON.stringify({ roomCode: 'AB12', index: 4, done: false }))
    assert.equal(readDurable(local, memoryKv(), 'belief-self-pace')?.includes('"index":4'), true)
  })
})

describe('transient membership errors', () => {
  it('does not clear a valid room on a single not_member or not_in_room', () => {
    for (const text of ['not_member', 'not_in_room', 'permission denied: not_member']) {
      const once = seatAfterFault('room-1', text, 0)
      assert.equal(once.seat, 'room-1')
      assert.equal(once.retry, true)
      assert.equal(once.misses, 1)
    }
  })

  it('keeps the room through a reconnect race, then clears only after repeated membership failures', () => {
    let seat: string | null = 'room-1'
    let misses = 0
    for (let index = 0; index < TRANSIENT_MEMBERSHIP_LIMIT - 1; index += 1) {
      const decision = seatAfterFault(seat, 'not_member', misses)
      seat = decision.seat
      misses = decision.misses
      assert.equal(decision.retry, true)
    }
    assert.equal(seat, 'room-1')
    const confirmed = seatAfterFault(seat, lobbyErrorText({ code: 'P0001', message: 'not_in_room' }), misses)
    assert.equal(confirmed.seat, null)
    assert.equal(confirmed.retry, false)
  })

  it('does not treat a network error as leaving the room', () => {
    const decision = seatAfterFault('room-1', 'Failed to fetch', 1)
    assert.equal(decision.seat, 'room-1')
    assert.equal(decision.misses, 1)
    assert.equal(decision.retry, false)
  })

  it('clears immediately when the room itself is gone', () => {
    const decision = seatAfterFault('room-1', lobbyErrorText({ message: 'room_not_found', hint: '' }), 0)
    assert.equal(decision.seat, null)
    assert.equal(decision.retry, false)
  })
})

describe('ended rooms and explicit leave', () => {
  it('forgets an ended room when this page is restoring into it', () => {
    assert.equal(shouldForgetEndedRoom({ status: 'ended', endedAt: null, sawLiveLobby: false }), true)
    assert.equal(shouldForgetEndedRoom({ status: 'playing', endedAt: '2026-11-11T00:00:00Z', sawLiveLobby: false }), true)
  })

  it('keeps the final screen up when the room ends while this page is already inside', () => {
    assert.equal(shouldForgetEndedRoom({ status: 'ended', endedAt: null, sawLiveLobby: true }), false)
  })

  it('keeps an active room on restore', () => {
    assert.equal(shouldForgetEndedRoom({ status: 'playing', endedAt: null, sawLiveLobby: false }), false)
    assert.equal(shouldForgetEndedRoom({ status: 'lobby', endedAt: null, sawLiveLobby: false }), false)
  })

  it('keeps an ended room on the host desk so a refresh can still show the session', () => {
    assert.equal(shouldForgetEndedRoom({ status: 'ended', endedAt: null, sawLiveLobby: false, hostDesk: true }), false)
    assert.equal(pathIsHostDesk('/host/control'), true)
    assert.equal(pathIsHostDesk('/belief-game-capstone/host'), true)
    assert.equal(pathIsHostDesk('/play'), false)
  })
})

describe('restore navigation', () => {
  it('does not send a restoring player to the join page', () => {
    assert.equal(restoreNavigation(nav({ pathname: '/play', hasYou: false, connection: 'connecting', pendingRoom: true })), null)
    assert.equal(restoreNavigation(nav({ pathname: '/play', hasYou: false, connection: 'reconnecting', pendingRoom: true })), null)
  })

  it('returns a reloaded player to the phase page they were on', () => {
    assert.equal(restoreNavigation(nav({ pathname: '/', hasYou: true, phase: 'lobby' })), '/play/lobby')
    assert.equal(restoreNavigation(nav({ pathname: '/', hasYou: true, phase: 'playing' })), '/play')
    assert.equal(restoreNavigation(nav({ pathname: '/', hasYou: true, phase: 'paused' })), '/play')
    assert.equal(restoreNavigation(nav({ pathname: '/play', hasYou: true, phase: 'final' })), '/play/final')
    assert.equal(restoreNavigation(nav({ pathname: '/play', hasYou: true, phase: 'playing', paceDone: true })), '/play/final')
    assert.equal(phasePath('lobby', false), '/play/lobby')
    assert.equal(phasePath('playing', false), '/play')
    assert.equal(phasePath('final', false), '/play/final')
  })

  it('sends an explicit leave back to the join page', () => {
    assert.equal(
      restoreNavigation(nav({ pathname: '/play/final', hasYou: false, connection: 'live', pendingRoom: false })),
      '/',
    )
  })

  it('returns a host to the desk they were on, without following a player into the join form', () => {
    assert.equal(
      restoreNavigation(
        nav({
          pathname: '/',
          hasYou: false,
          hostUnlocked: true,
          lastPath: '/host/control',
        }),
      ),
      '/host/control',
    )
    assert.equal(
      restoreNavigation(
        nav({
          pathname: '/',
          hasYou: true,
          phase: 'playing',
          hostUnlocked: true,
          lastPath: '/host/analytics',
        }),
      ),
      '/host/analytics',
    )
  })

  it('returns a host who was answering cards to the play page', () => {
    assert.equal(
      restoreNavigation(
        nav({
          pathname: '/',
          hasYou: true,
          phase: 'playing',
          hostUnlocked: true,
          lastPath: '/play',
        }),
      ),
      '/play',
    )
  })

  it('does not pull a host off the desk while they are already there', () => {
    assert.equal(restoreNavigation(nav({ pathname: '/host/control', hasYou: true, phase: 'playing' })), null)
  })
})

describe('host desk persistence', () => {
  const now = 1_700_000_000_000

  it('restores the desk after session storage is discarded and never puts the pin in a path', () => {
    const local = memoryKv()
    const session = memoryKv()
    saveHostDesk(local, session, { scope: 'session', roomCode: 'AB12', proofPin: '135790' }, now)
    const surface = surfaceToRemember('/host/control?pin=135790#135790', true)
    assert.equal(surface, '/host/control')
    assert.equal(surface?.includes('135790'), false)
    saveSurface(local, session, surface)
    const discarded = memoryKv()
    const loaded = loadHostDesk(local, discarded, now + 60_000)
    assert.equal(loaded?.proofPin, '135790')
    assert.equal(loaded?.roomCode, 'AB12')
    assert.equal(discarded.getItem(HOST_DESK_KEY), null)
    const url = new URL('https://belief-game-capstone.vercel.app/host/control')
    assert.equal(url.search, '')
    assert.equal(url.pathname.includes('135790'), false)
  })

  it('drops the pin on lock and after the desk has been idle past the limit', () => {
    const local = memoryKv()
    const session = memoryKv()
    saveHostDesk(local, session, { scope: 'operator', roomCode: null, proofPin: '246810' }, now)
    assert.equal(loadHostDesk(local, session, now + HOST_DESK_TTL_MS + 1), null)
    assert.equal(local.getItem(HOST_DESK_KEY), null)
    saveHostDesk(local, session, { scope: 'preview', roomCode: 'AB12', proofPin: '135790' }, now)
    saveHostDesk(local, session, null)
    assert.equal(loadHostDesk(local, session, now), null)
    assert.equal(session.getItem(HOST_DESK_KEY), null)
  })
})

describe('live client wiring', () => {
  it('does not keep the anonymous session or the room id only in sessionStorage', () => {
    const store = readFileSync(new URL('./store.ts', import.meta.url), 'utf8')
    const supabase = readFileSync(new URL('../lib/supabase.ts', import.meta.url), 'utf8')
    const pace = readFileSync(new URL('../self/pace.ts', import.meta.url), 'utf8')
    assert.equal(store.includes('sessionStorage.getItem(ROOM_KEY)'), false)
    assert.equal(store.includes('readKey(ROOM_KEY)'), true)
    assert.equal(store.includes("rememberRoom(null)\n      memory"), false)
    assert.equal(supabase.includes('window.sessionStorage'), false)
    assert.equal(supabase.includes('durableAuthStorage'), true)
    assert.equal(pace.includes('sessionStorage'), false)
    assert.equal(pace.includes('writeDurable'), true)
    assert.equal(pace.includes('belief-self-pace'), true)
  })
})
