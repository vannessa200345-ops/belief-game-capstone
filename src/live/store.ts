import { findCard } from '../domain/cards.ts'
import { parseNoticeEmail } from '../domain/email.ts'
import { parseDisplayName } from '../domain/name.ts'
import type {
  ActionResult,
  Connection,
  DeckId,
  GameState,
  JoinResult,
  NoticeEmailResult,
  PersistedState,
} from '../domain/types.ts'
import { liveBackend } from '../lib/env.ts'
import { ensureAnonymousSession, getSupabase } from '../lib/supabase.ts'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { clearPace } from '../self/pace.ts'
import { explain } from './errors.ts'
import { mapLobby } from './mapLobby.ts'
import type { CardEventRow, LobbySnapshot, SpeakDequeue } from './types.ts'

const ROOM_KEY = 'belief-live-room'
const DECK_KEY = 'belief-live-deck'
const BOOT = '__beliefLiveBooted'

const emptyState: PersistedState = {
  room: {
    code: '',
    deck: 'core',
    phase: 'lobby',
    cardIndex: 0,
    roundStartedAt: null,
    createdAt: Date.now(),
  },
  players: [],
  youId: null,
  answers: [],
  timeouts: [],
  queue: [],
  called: null,
  botPlans: [],
  notices: [],
  remoteAnswered: {},
  serverAnswerCount: 0,
}

let memory: PersistedState = emptyState
let connection: Connection = 'connecting'
let snapshot: GameState = { ...emptyState, connection, selfPaceLink: 'unknown' }
let roomId: string | null = null
let called: GameState['called'] = null
let events: CardEventRow[] = []
let deckPref: DeckId = 'core'
const listeners = new Set<() => void>()
let refreshChain: Promise<void> = Promise.resolve()
let roomChannel: RealtimeChannel | null = null
let selfPaceRpc: 'unknown' | 'live' | 'missing' = 'unknown'
let remoteAnswered: Record<string, number> = {}
let playingSince: number | null = null

function isMissingRpc(error: unknown): boolean {
  const text = JSON.stringify(error)
  return (
    text.includes('PGRST202') ||
    text.includes('Could not find the function') ||
    text.includes('schema cache') ||
    text.includes('"status":404') ||
    text.includes('"status": 404')
  )
}

function parseRemote(data: unknown): Record<string, number> {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? Array.isArray((data as { players?: unknown }).players)
        ? (data as { players: unknown[] }).players
        : Array.isArray((data as { progress?: unknown }).progress)
          ? (data as { progress: unknown[] }).progress
          : [data]
      : []
  const counts: Record<string, number> = {}
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const record = row as { player_id?: unknown; playerId?: unknown; answered_count?: unknown; answered?: unknown }
    const id = typeof record.player_id === 'string' ? record.player_id : typeof record.playerId === 'string' ? record.playerId : ''
    if (!id) continue
    const count = Number(record.answered_count ?? record.answered ?? 0)
    if (!Number.isFinite(count)) continue
    counts[id] = count
  }
  return counts
}

function readIsCorrect(data: unknown): boolean | null {
  if (!data || typeof data !== 'object') return null
  const value = (data as { is_correct?: unknown }).is_correct
  if (value === true || value === false) return value
  return null
}

function publish() {
  snapshot = { ...memory, connection, called, selfPaceLink: selfPaceRpc }
  for (const listener of listeners) listener()
}

function readDeck(): DeckId {
  const raw = sessionStorage.getItem(DECK_KEY)
  if (raw === 'money' || raw === 'relationship' || raw === 'core') return raw
  return 'core'
}

function rememberRoom(id: string | null) {
  roomId = id
  if (id) sessionStorage.setItem(ROOM_KEY, id)
  else sessionStorage.removeItem(ROOM_KEY)
  bindRoomChannel(id)
}

/** rooms / players / speak_queue on `room:{room_id}`. Rounds and answers are not on this channel. */
function bindRoomChannel(id: string | null) {
  const supabase = getSupabase()
  if (roomChannel) {
    void supabase.removeChannel(roomChannel)
    roomChannel = null
  }
  if (!id) return
  const refetch = () => {
    void scheduleRefresh()
  }
  roomChannel = supabase
    .channel(`room:${id}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${id}` },
      refetch,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'speak_queue', filter: `room_id=eq.${id}` },
      refetch,
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${id}` },
      refetch,
    )
    .subscribe()
}

function rememberDeck(deck: DeckId) {
  deckPref = deck
  sessionStorage.setItem(DECK_KEY, deck)
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  await ensureAnonymousSession()
  const { data, error } = await getSupabase().rpc(fn, args)
  if (error) throw error
  return data as T
}

async function loadEvents(id: string) {
  const { data, error } = await getSupabase()
    .from('card_events')
    .select('player_id,card_id,choice_id,is_correct,time_ms')
    .eq('room_id', id)
  if (error || !data) return
  events = data as CardEventRow[]
}

async function refreshOnce() {
  if (!roomId) {
    connection = 'live'
    publish()
    return
  }
  try {
    const lobby = await rpc<LobbySnapshot>('get_room_lobby', { p_room_id: roomId })
    await loadEvents(lobby.room_id)
    memory = mapLobby(lobby, events, called, deckPref)
    if (memory.room.phase === 'playing') {
      if (playingSince == null) playingSince = Date.now()
      memory.room.roundStartedAt = playingSince
    } else if (memory.room.phase === 'lobby' || memory.room.phase === 'final') {
      playingSince = null
    }
    try {
      const progress = await rpc<unknown>('get_self_paced_progress', { p_room_id: lobby.room_id })
      selfPaceRpc = 'live'
      remoteAnswered = parseRemote(progress)
    } catch (error) {
      if (isMissingRpc(error)) {
        if (selfPaceRpc !== 'live') selfPaceRpc = 'missing'
      } else if (selfPaceRpc === 'unknown') {
        selfPaceRpc = 'live'
      }
    }
    memory.remoteAnswered = remoteAnswered
    if (memory.room.deck !== deckPref && lobby.rounds.length + (lobby.open_round ? 1 : 0) > 0) {
      deckPref = memory.room.deck
    }
    connection = 'live'
    publish()
  } catch (error) {
    const text = `${error instanceof Error ? error.message : ''} ${typeof error === 'object' && error && 'hint' in error ? String((error as { hint?: string }).hint) : ''}`
    if (text.includes('room_not_found') || text.includes('not_member') || text.includes('not_in_room')) {
      rememberRoom(null)
      memory = { ...emptyState, room: { ...emptyState.room, deck: deckPref } }
      events = []
      called = null
    }
    connection = 'reconnecting'
    publish()
  }
}

function scheduleRefresh() {
  refreshChain = refreshChain.then(() => refreshOnce()).catch(() => undefined)
  return refreshChain
}

async function run<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } finally {
    await scheduleRefresh()
  }
}

function fail(error: unknown): ActionResult {
  return { ok: false, error: explain(error) }
}

export function getSnapshot() {
  return snapshot
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function readState() {
  return snapshot
}

export async function createRoom(input: { deck: DeckId; name: string; email?: string }): Promise<ActionResult> {
  const display = parseDisplayName(input.name)
  const notice = parseNoticeEmail(input.email ?? '')
  if (!display.ok) return display
  if (!notice.ok) return notice
  return run(async () => {
    try {
      if (roomId) {
        try {
          await rpc('end_room', { p_room_id: roomId })
        } catch {
          /* 舊房已結束時仍可開新房。 */
        }
      }
      rememberDeck(input.deck)
      called = null
      events = []
      remoteAnswered = {}
      playingSince = null
      clearPace()
      const created = await rpc<{ room_id: string; code: string; player_id: string }>('create_room', {
        p_display_name: display.name,
        p_email: notice.email,
      })
      rememberRoom(created.room_id)
      try {
        await rpc('update_room_config', {
          p_room_id: created.room_id,
          p_deck_id: input.deck,
          p_config: null,
          p_max_players: null,
        })
      } catch {
        /* 房已開出。牌套寫唔入時，學員仍可以用連結加入。 */
      }
      return { ok: true }
    } catch (error) {
      return fail(error)
    }
  })
}

export async function joinRoom(input: { code: string; name: string; email?: string }): Promise<JoinResult> {
  const cleanedCode = input.code.trim().toUpperCase()
  const display = parseDisplayName(input.name)
  const notice = parseNoticeEmail(input.email ?? '')
  if (!cleanedCode) return { ok: false, error: '請輸入房間碼。' }
  if (!display.ok) return display
  if (!notice.ok) return notice

  return run(async () => {
    try {
      const joined = await rpc<{ room_id: string; player_id: string; code: string }>('join_room', {
        p_code: cleanedCode,
        p_display_name: display.name,
        p_email: notice.email,
      })
      rememberRoom(joined.room_id)
      called = null
      remoteAnswered = {}
      playingSince = null
      clearPace()
      return { ok: true }
    } catch (error) {
      return fail(error)
    }
  })
}

export async function leaveRoom(): Promise<ActionResult> {
  return run(async () => {
    try {
      if (roomId) await rpc('leave_room', { p_room_id: roomId })
      rememberRoom(null)
      called = null
      events = []
      remoteAnswered = {}
      playingSince = null
      clearPace()
      memory = { ...emptyState, room: { ...emptyState.room, deck: deckPref } }
      return { ok: true }
    } catch (error) {
      return fail(error)
    }
  })
}

export async function saveNoticeEmail(email: string): Promise<NoticeEmailResult> {
  const notice = parseNoticeEmail(email)
  if (!notice.ok) return notice
  const you = memory.players.find((player) => player.id === memory.youId)
  if (!you || !memory.room.code) return { ok: false, error: '你已經不在這一場裡。' }
  if ((you.email ?? null) === notice.email) return { ok: true, email: notice.email }

  return run(async () => {
    try {
      await rpc('join_room', {
        p_code: memory.room.code,
        p_display_name: you.name,
        p_email: notice.email ?? '',
      })
      return { ok: true, email: notice.email }
    } catch (error) {
      return { ok: false, error: explain(error) }
    }
  })
}

export async function startRoom(): Promise<ActionResult> {
  return run(async () => {
    try {
      if (!roomId) return { ok: false, error: '請先開一場，再把房間碼交給學員。' }
      const lobby = await rpc<LobbySnapshot>('get_room_lobby', { p_room_id: roomId })
      if (lobby.status === 'ended' || lobby.ended_at) return { ok: false, error: '這一場已結束。' }
      if (lobby.status === 'lobby' || lobby.status === 'paused') {
        await rpc('start_room', { p_room_id: roomId })
      }
      try {
        const { hostDeckPayload } = await import('../host/coreKey.ts')
        await rpc('start_self_paced', {
          p_room_id: roomId,
          p_deck: hostDeckPayload(),
        })
        selfPaceRpc = 'live'
      } catch (error) {
        if (!isMissingRpc(error)) return fail(error)
        selfPaceRpc = 'missing'
      }
      return { ok: true }
    } catch (error) {
      return fail(error)
    }
  })
}

export async function endRoom(): Promise<ActionResult> {
  return run(async () => {
    try {
      if (!roomId) return { ok: false, error: '請先開一場。' }
      await rpc('end_room', { p_room_id: roomId })
      return { ok: true }
    } catch (error) {
      return fail(error)
    }
  })
}

export async function revealRound(): Promise<ActionResult> {
  return { ok: false, error: '這一場是自速，不用逐張揭示。' }
}

export async function nextRound(): Promise<ActionResult> {
  return { ok: false, error: '學員會自己去下一張。' }
}

export async function submitAnswer(optionId: string): Promise<ActionResult> {
  return run(async () => {
    try {
      if (!roomId) return { ok: false, error: '你還沒有進入房間。' }
      const lobby = await rpc<LobbySnapshot>('get_room_lobby', { p_room_id: roomId })
      const open = lobby.open_round
      if (!open || open.revealed_at) return { ok: false, error: '這一張現在不能選。' }
      const card = findCard(open.card_id)
      if (card && !card.options.some((option) => option.id === optionId)) {
        return { ok: false, error: '這個選項不在這一張上。' }
      }
      const already = events.some((event) => event.player_id === lobby.you.player_id && event.card_id === open.card_id)
      if (already) return { ok: true }
      const started = Date.parse(open.started_at)
      const ms = Number.isNaN(started) ? 0 : Math.max(0, Date.now() - started)
      await rpc('submit_answer', {
        p_choice_id: optionId,
        p_round_id: open.round_id,
        p_time_ms: ms,
      })
      return { ok: true }
    } catch (error) {
      return fail(error)
    }
  })
}

export async function submitSelfPaced(input: {
  cardId: string
  choiceId: 'yes' | 'no'
  timeMs: number
}): Promise<{ ok: true; isCorrect: boolean | null } | { ok: false; error: string }> {
  if (input.choiceId !== 'yes' && input.choiceId !== 'no') {
    return { ok: false, error: '只可以選是或否。' }
  }
  if (!findCard(input.cardId)) return { ok: false, error: '找不到這一句。' }
  if (!roomId) return { ok: false, error: '你還沒有進入房間。' }
  if (selfPaceRpc === 'missing') return { ok: true, isCorrect: null }
  try {
    const data = await rpc<unknown>('submit_self_paced', {
      p_room_id: roomId,
      p_card_id: input.cardId,
      p_choice_id: input.choiceId,
      p_time_ms: Math.max(0, Math.round(input.timeMs)),
    })
    selfPaceRpc = 'live'
    return { ok: true, isCorrect: readIsCorrect(data) }
  } catch (error) {
    if (isMissingRpc(error)) {
      selfPaceRpc = 'missing'
      return { ok: true, isCorrect: null }
    }
    return { ok: false, error: explain(error) }
  }
}

export async function requestSpeak(): Promise<ActionResult> {
  return run(async () => {
    try {
      if (!roomId) return { ok: false, error: '你還沒有進入房間。' }
      await rpc('enqueue_speak', { p_room_id: roomId })
      return { ok: true }
    } catch (error) {
      return fail(error)
    }
  })
}

export async function lowerHand(): Promise<ActionResult> {
  return run(async () => {
    try {
      if (!roomId) return { ok: false, error: '你還沒有進入房間。' }
      await rpc<SpeakDequeue>('dequeue_speak', { p_room_id: roomId })
      return { ok: true }
    } catch (error) {
      return fail(error)
    }
  })
}

export async function clearSpeakQueue(): Promise<ActionResult> {
  return run(async () => {
    try {
      if (!roomId) return { ok: false, error: '請先開一場。' }
      await rpc('clear_speak_queue', { p_room_id: roomId })
      called = null
      return { ok: true }
    } catch (error) {
      return fail(error)
    }
  })
}

export async function pauseRoom(): Promise<ActionResult> {
  return run(async () => {
    try {
      if (!roomId) return { ok: false, error: '請先開一場。' }
      await rpc('pause_room', { p_room_id: roomId })
      return { ok: true }
    } catch (error) {
      return fail(error)
    }
  })
}

/** 主持叫名只記在這一頁。dequeue_speak 只可以放下自己的手。 */
export async function advanceSpeaker(): Promise<ActionResult> {
  if (memory.queue.length === 0) return { ok: false, error: '現在沒有人在排隊。' }
  const start = memory.queue.findIndex((item) => item.playerId === called?.playerId)
  const next = memory.queue[(start + 1) % memory.queue.length]
  if (!next) return { ok: false, error: '現在沒有人在排隊。' }
  called = { playerId: next.playerId, at: Date.now() }
  publish()
  return { ok: true }
}

function boot() {
  deckPref = readDeck()
  memory = { ...emptyState, room: { ...emptyState.room, deck: deckPref } }
  roomId = sessionStorage.getItem(ROOM_KEY)
  void (async () => {
    try {
      await ensureAnonymousSession()
      if (roomId) bindRoomChannel(roomId)
    } catch {
      connection = 'reconnecting'
      publish()
    }
    void scheduleRefresh()
  })()
  window.setInterval(() => {
    if (roomId && document.visibilityState !== 'hidden') void scheduleRefresh()
  }, 4000)
  window.addEventListener('online', () => {
    void scheduleRefresh()
  })
  window.addEventListener('offline', () => {
    connection = 'reconnecting'
    publish()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void scheduleRefresh()
  })
}

const globalScope = globalThis as typeof globalThis & { [BOOT]?: boolean }
if (typeof window !== 'undefined' && liveBackend && !globalScope[BOOT]) {
  globalScope[BOOT] = true
  boot()
}
