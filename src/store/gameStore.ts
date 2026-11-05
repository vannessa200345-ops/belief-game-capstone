import { cardAt, cardsFor, deckHasAnswerKey, findCard } from '../domain/cards.ts'
import { clearPace } from '../self/pace.ts'
import {
  DEMO_NAMES,
  DEMO_ROOM_CODE,
  OFFLINE_DEMO_NAME,
  ROOM_CAPACITY,
  STORAGE_KEY,
} from '../domain/constants.ts'
import { parseNoticeEmail } from '../domain/email.ts'
import { tx } from '../i18n/text.ts'
import { parseDisplayName } from '../domain/name.ts'
import type {
  BeliefCard,
  BotPlan,
  Connection,
  DeckId,
  GameState,
  ActionResult,
  JoinResult,
  NoticeEmailResult,
  PersistedState,
  Player,
  Room,
  RoomNote,
} from '../domain/types.ts'

const LOCK = 'belief-game-mvp'
const CHANNEL_NAME = 'belief-game-mvp'

interface Envelope {
  version: number
  state: PersistedState
}

type Mutate = (draft: PersistedState) => boolean

let version = 0
let memory: PersistedState
let connection: Connection = 'connecting'
let snapshot: GameState
const listeners = new Set<() => void>()
let sequence = 0

function uid(prefix: string) {
  sequence += 1
  return `${prefix}-${Date.now().toString(36)}-${sequence}`
}

function unit(seed: string) {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}

function demoPlayers(now: number): Player[] {
  return DEMO_NAMES.map((name, index) => ({
    id: `demo-${String(index + 1).padStart(2, '0')}`,
    name,
    demo: true,
    joinedAt: now - (DEMO_NAMES.length - index) * 60_000,
    connected: name !== OFFLINE_DEMO_NAME,
  }))
}

function makeRoom(code: string, deck: DeckId, now: number): Room {
  return {
    code,
    deck,
    phase: 'lobby',
    cardIndex: 0,
    roundStartedAt: null,
    createdAt: now,
  }
}

function createSeed(code: string, deck: DeckId): PersistedState {
  const now = Date.now()
  return {
    room: makeRoom(code, deck, now),
    players: demoPlayers(now),
    youId: null,
    answers: [],
    timeouts: [],
    queue: [],
    called: null,
    botPlans: [],
    notices: [],
    notes: [],
    remoteAnswered: {},
    serverAnswerCount: 0,
  }
}

function hydrate(state: PersistedState): PersistedState {
  return {
    ...state,
    notices: Array.isArray(state.notices) ? state.notices : [],
    notes: Array.isArray(state.notes) ? state.notes : [],
    remoteAnswered: state.remoteAnswered ?? {},
    serverAnswerCount: state.serverAnswerCount ?? 0,
    players: state.players.map((player) => ({
      ...player,
      email: typeof player.email === 'string' && player.email.length > 0 ? player.email : null,
    })),
  }
}

function isPersisted(value: unknown): value is PersistedState {
  if (!value || typeof value !== 'object') return false
  const state = value as PersistedState
  return Boolean(
    state.room &&
      typeof state.room.code === 'string' &&
      typeof state.room.deck === 'string' &&
      Array.isArray(state.players) &&
      Array.isArray(state.answers) &&
      Array.isArray(state.timeouts) &&
      Array.isArray(state.queue) &&
      Array.isArray(state.botPlans),
  )
}

function readDisk(): Envelope | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Envelope
    if (!parsed || typeof parsed.version !== 'number' || !isPersisted(parsed.state)) return null
    return { version: parsed.version, state: hydrate(parsed.state) }
  } catch {
    return null
  }
}

function writeDisk() {
  const envelope: Envelope = { version, state: memory }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
}

function withConnection(state: PersistedState): GameState {
  return { ...state, connection, selfPaceLink: 'missing' }
}

function publish() {
  snapshot = withConnection(memory)
  for (const listener of listeners) listener()
}

function boot() {
  const disk = readDisk()
  if (disk) {
    version = disk.version
    memory = disk.state
  } else {
    memory = createSeed(DEMO_ROOM_CODE, 'core')
    version = 1
    try {
      writeDisk()
    } catch {
      /* 私人模式寫不入時，仍可在這一頁使用。 */
    }
  }
  snapshot = withConnection(memory)
}

boot()

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null

channel?.addEventListener('message', (event: MessageEvent<Envelope>) => {
  const data = event.data
  if (!data || typeof data.version !== 'number' || data.version <= version || !isPersisted(data.state)) return
  version = data.version
  memory = hydrate(data.state)
  publish()
})

window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return
  const disk = readDisk()
  if (!disk || disk.version <= version) return
  version = disk.version
  memory = disk.state
  publish()
})

function reloadFromDisk() {
  const disk = readDisk()
  if (!disk || disk.version <= version) return false
  version = disk.version
  memory = disk.state
  return true
}

async function commit(mutate: Mutate) {
  const run = () => {
    const behind = reloadFromDisk()
    const draft = structuredClone(memory)
    const changed = mutate(draft)
    if (!changed) {
      if (behind) publish()
      return
    }
    memory = draft
    version += 1
    try {
      writeDisk()
    } catch {
      /* 保持記憶體狀態，讓這一頁仍可操作。 */
    }
    channel?.postMessage({ version, state: memory } satisfies Envelope)
    publish()
  }

  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    await navigator.locks.request(LOCK, run)
  } else {
    run()
  }
}

function pickChoice(roll: number): 'yes' | 'no' {
  return roll < 0.5 ? 'yes' : 'no'
}

function makePlans(card: BeliefCard, players: Player[], startedAt: number): BotPlan[] {
  const bots = players
    .filter((player) => player.demo && player.connected)
    .sort((a, b) => a.id.localeCompare(b.id))
  const plans: BotPlan[] = []

  bots.forEach((player, index) => {
    if (index < 2) {
      plans.push({ playerId: player.id, cardId: card.id, dueAt: startedAt, kind: 'timeout' })
      return
    }
    if (index < 4) {
      plans.push({ playerId: player.id, cardId: card.id, dueAt: startedAt, kind: 'stuck' })
      return
    }
    const optionId = pickChoice(unit(`${player.id}:${card.id}:opt`))
    const delay = 800 + Math.floor(unit(`${player.id}:${card.id}:t`) * 2400)
    plans.push({
      playerId: player.id,
      cardId: card.id,
      dueAt: startedAt + delay,
      kind: 'answer',
      optionId,
    })
    if (index < 7) {
      plans.push({
        playerId: player.id,
        cardId: card.id,
        dueAt: startedAt + (index - 4) * 700,
        kind: 'queue',
      })
    }
  })

  return plans
}

function beginCard(draft: PersistedState, index: number) {
  const card = cardAt(draft.room.deck, index)
  if (!card) return
  const startedAt = Date.now()
  draft.room.phase = 'playing'
  draft.room.cardIndex = index
  draft.room.roundStartedAt = startedAt
  draft.called = null
  const plans = makePlans(card, draft.players, startedAt)
  const immediate = plans.find((plan) => plan.kind === 'queue')
  draft.botPlans = immediate ? plans.filter((plan) => plan !== immediate) : plans
  if (immediate && !draft.queue.some((item) => item.playerId === immediate.playerId)) {
    draft.queue.push({ id: uid('q'), playerId: immediate.playerId, requestedAt: startedAt })
  }
  for (const plan of plans) {
    if (plan.kind !== 'timeout') continue
    const exists = draft.timeouts.some((mark) => mark.playerId === plan.playerId && mark.cardId === card.id)
    if (exists) continue
    draft.timeouts.push({ playerId: plan.playerId, cardId: card.id, ms: 0 })
  }
}

function applyDue(draft: PersistedState, now: number) {
  if (draft.room.phase !== 'playing' || draft.room.roundStartedAt == null) return false
  const card = cardAt(draft.room.deck, draft.room.cardIndex)
  if (!card) return false
  let changed = false

  for (const plan of draft.botPlans) {
    if (plan.cardId !== card.id || plan.dueAt > now) continue
    if (plan.kind === 'answer' && plan.optionId) {
      const answered = draft.answers.some((answer) => answer.playerId === plan.playerId && answer.cardId === card.id)
      const timedOut = draft.timeouts.some((mark) => mark.playerId === plan.playerId && mark.cardId === card.id)
      if (!answered && !timedOut) {
        draft.answers.push({
          playerId: plan.playerId,
          cardId: card.id,
          optionId: plan.optionId,
          ms: Math.max(0, plan.dueAt - draft.room.roundStartedAt),
          correct: null,
        })
        changed = true
      }
    }
    if (plan.kind === 'queue' && !draft.queue.some((item) => item.playerId === plan.playerId)) {
      draft.queue.push({ id: uid('q'), playerId: plan.playerId, requestedAt: plan.dueAt })
      changed = true
    }
  }

  return changed
}

function makeCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let index = 0; index < 4; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code === memory.room.code ? makeCode() : code
}

const timerFlag = '__beliefGameTimer'
const globalScope = globalThis as typeof globalThis & { [timerFlag]?: number }
if (typeof window !== 'undefined' && globalScope[timerFlag] == null) {
  globalScope[timerFlag] = window.setInterval(() => {
    void commit((draft) => applyDue(draft, Date.now()))
  }, 400)
}

window.setTimeout(() => {
  connection = 'live'
  publish()
}, 650)

window.addEventListener('offline', () => {
  connection = 'reconnecting'
  publish()
})

window.addEventListener('online', () => {
  connection = 'live'
  publish()
})

let hiddenAt = 0
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now()
    return
  }
  if (!hiddenAt || Date.now() - hiddenAt < 8_000) return
  connection = 'reconnecting'
  publish()
  window.setTimeout(() => {
    if (connection === 'reconnecting') {
      connection = 'live'
      publish()
    }
  }, 1200)
})

export function getSnapshot() {
  return snapshot
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function createRoom(deck: DeckId) {
  clearPace()
  await commit((draft) => {
    const fresh = createSeed(makeCode(), deck)
    draft.room = fresh.room
    draft.players = fresh.players
    draft.youId = null
    draft.answers = []
    draft.timeouts = []
    draft.queue = []
    draft.called = null
    draft.botPlans = []
    draft.notices = []
    draft.notes = []
    return true
  })
  return { ok: true as const }
}

function rememberNotice(draft: PersistedState, name: string, email: string) {
  if (!Array.isArray(draft.notices)) draft.notices = []
  const key = email.toLowerCase()
  const existing = draft.notices.find((notice) => notice.email.toLowerCase() === key)
  if (existing) {
    existing.name = name
    existing.email = email
    existing.at = Date.now()
    return
  }
  draft.notices.push({ id: uid('n'), name, email, at: Date.now() })
}

export async function joinRoom(input: { code: string; name: string; email?: string }): Promise<JoinResult> {
  let result: JoinResult = { ok: false, error: tx('暫時未能進入。請再試一次。', 'Could not enter. Try again.') }
  await commit((draft) => {
    const cleanedCode = input.code.trim().toUpperCase()
    const display = parseDisplayName(input.name)
    const notice = parseNoticeEmail(input.email ?? '')
    if (!cleanedCode) {
      result = { ok: false, error: tx('請輸入房間碼。', 'Enter a room code.') }
      return false
    }
    if (!display.ok) {
      result = display
      return false
    }
    const cleanedName = display.name
    if (!notice.ok) {
      result = { ok: false, error: notice.error }
      return false
    }
    if (cleanedCode !== draft.room.code) {
      result = { ok: false, error: tx('找不到這個房間。請再對一次房間碼。', 'That room was not found. Check the room code.') }
      return false
    }
    if (draft.youId && draft.players.some((player) => player.id === draft.youId)) {
      result = { ok: true }
      return false
    }
    if (draft.players.length >= ROOM_CAPACITY) {
      result = { ok: false, error: tx('這個房間已滿三十人。', 'This room is full at thirty people.') }
      return false
    }
    const player: Player = {
      id: `you-${crypto.randomUUID()}`,
      name: cleanedName,
      demo: false,
      joinedAt: Date.now(),
      connected: true,
      email: notice.email,
    }
    draft.players.push(player)
    draft.youId = player.id
    if (notice.email) rememberNotice(draft, cleanedName, notice.email)
    result = { ok: true }
    return true
  })
  if (result.ok) clearPace()
  return result
}

export async function saveNoticeEmail(email: string): Promise<NoticeEmailResult> {
  let result: NoticeEmailResult = { ok: false, error: '暫時未能記下。請再試一次。' }
  await commit((draft) => {
    const notice = parseNoticeEmail(email)
    if (!notice.ok) {
      result = notice
      return false
    }
    const you = draft.players.find((player) => player.id === draft.youId)
    if (!you) {
      result = { ok: false, error: '你已經不在這一場裡。' }
      return false
    }
    const previous = you.email ?? null
    if (previous === notice.email) {
      result = { ok: true, email: notice.email }
      return false
    }
    if (previous) {
      draft.notices = (draft.notices ?? []).filter((item) => item.email.toLowerCase() !== previous.toLowerCase())
    }
    you.email = notice.email
    if (notice.email) rememberNotice(draft, you.name, notice.email)
    result = { ok: true, email: notice.email }
    return true
  })
  return result
}

export async function leaveRoom() {
  await commit((draft) => {
    if (!draft.youId) return false
    const leaving = draft.youId
    draft.players = draft.players.filter((player) => player.id !== leaving)
    draft.queue = draft.queue.filter((item) => item.playerId !== leaving)
    if (draft.called?.playerId === leaving) draft.called = null
    draft.youId = null
    return true
  })
  clearPace()
  return { ok: true as const }
}

export async function endRoom() {
  await commit((draft) => {
    if (draft.room.phase === 'lobby' || draft.room.phase === 'final') return false
    draft.room.phase = 'final'
    draft.botPlans = []
    return true
  })
  return { ok: true as const }
}

export async function submitSelfPaced(input: { cardId: string; choiceId: 'yes' | 'no'; timeMs: number }) {
  if (input.choiceId !== 'yes' && input.choiceId !== 'no') {
    return { ok: false as const, error: '只可以選是或毫無道理。' }
  }
  const card = findCard(input.cardId)
  if (!card) return { ok: false as const, error: '找不到這一句。' }
  let isCorrect: boolean | null = null
  if (deckHasAnswerKey(card.deck)) {
    const { gradeHostChoice } = await import('../host/coreKey.ts')
    isCorrect = gradeHostChoice(input.cardId, input.choiceId)
  }
  let accepted = false
  await commit((draft) => {
    if (!draft.youId || draft.room.phase !== 'playing') return false
    accepted = true
    const answered = draft.answers.some((answer) => answer.playerId === draft.youId && answer.cardId === card.id)
    if (answered) return true
    draft.answers.push({
      playerId: draft.youId,
      cardId: card.id,
      optionId: input.choiceId,
      ms: Math.max(0, input.timeMs),
      correct: isCorrect,
    })
    return true
  })
  if (!accepted) return { ok: false as const, error: '這一刻還不能選。' }
  return { ok: true as const, isCorrect }
}

export async function startRoom() {
  await commit((draft) => {
    if (draft.room.phase === 'paused') {
      draft.room.phase = 'playing'
      return true
    }
    if (draft.room.phase !== 'lobby') return false
    if (cardsFor(draft.room.deck).length === 0) return false
    beginCard(draft, 0)
    return true
  })
  return { ok: true as const }
}

export async function revealRound() {
  await commit((draft) => {
    if (draft.room.phase !== 'playing') return false
    draft.room.phase = 'revealed'
    return true
  })
  return { ok: true as const }
}

export async function nextRound() {
  await commit((draft) => {
    if (draft.room.phase !== 'revealed') return false
    const total = cardsFor(draft.room.deck).length
    const nextIndex = draft.room.cardIndex + 1
    if (nextIndex >= total) {
      draft.room.phase = 'final'
      draft.botPlans = []
      return true
    }
    beginCard(draft, nextIndex)
    return true
  })
  return { ok: true as const }
}

export async function submitAnswer(optionId: string) {
  await commit((draft) => {
    if (draft.room.phase !== 'playing' || !draft.youId || draft.room.roundStartedAt == null) return false
    const card = cardAt(draft.room.deck, draft.room.cardIndex)
    if (!card || !card.options.some((option) => option.id === optionId)) return false
    const answered = draft.answers.some((answer) => answer.playerId === draft.youId && answer.cardId === card.id)
    if (answered) return false
    draft.answers.push({
      playerId: draft.youId,
      cardId: card.id,
      optionId,
      ms: Math.max(0, Date.now() - draft.room.roundStartedAt),
      correct: null,
    })
    return true
  })
  return { ok: true as const }
}

export async function lowerHand() {
  await commit((draft) => {
    if (!draft.youId) return false
    const next = draft.queue.filter((item) => item.playerId !== draft.youId)
    if (next.length === draft.queue.length) return false
    draft.queue = next
    return true
  })
  return { ok: true as const }
}

export async function clearSpeakQueue() {
  await commit((draft) => {
    if (draft.queue.length === 0) return false
    draft.queue = []
    return true
  })
  return { ok: true as const }
}

export async function pauseRoom() {
  await commit((draft) => {
    if (draft.room.phase !== 'playing') return false
    draft.room.phase = 'paused'
    return true
  })
  return { ok: true as const }
}

export async function sendNote(text: string, fromHost = false): Promise<ActionResult> {
  const cleaned = text.trim().slice(0, 240)
  if (!cleaned) return { ok: false, error: tx('請先寫一句。', 'Write a line first.') }
  let result: ActionResult = { ok: false, error: tx('而家仲未可以傳字。', 'You cannot text yet.') }
  await commit((draft) => {
    const phase = draft.room.phase
    if (phase !== 'playing' && phase !== 'paused' && phase !== 'final') return false
    const you = draft.players.find((player) => player.id === draft.youId)
    if (!you && !fromHost) {
      result = { ok: false, error: tx('你還沒有進入房間。', 'You are not in the room yet.') }
      return false
    }
    const host = Boolean(fromHost || you?.host)
    const note: RoomNote = {
      id: uid('note'),
      playerId: you?.id ?? `host-${draft.room.code}`,
      name: host ? (you?.host ? you.name : '主持') : (you?.name ?? '學員'),
      text: cleaned,
      at: Date.now(),
      fromHost: host,
    }
    if (!Array.isArray(draft.notes)) draft.notes = []
    draft.notes.push(note)
    result = { ok: true }
    return true
  })
  return result
}

export async function requestSpeak() {
  await commit((draft) => {
    if (!draft.youId) return false
    if (draft.room.phase !== 'playing' && draft.room.phase !== 'paused' && draft.room.phase !== 'revealed') {
      return false
    }
    if (draft.queue.some((item) => item.playerId === draft.youId)) return false
    draft.queue.push({ id: uid('q'), playerId: draft.youId, requestedAt: Date.now() })
    return true
  })
  return { ok: true as const }
}

export async function advanceSpeaker() {
  await commit((draft) => {
    const next = draft.queue.shift()
    if (!next) return false
    draft.called = { playerId: next.playerId, at: Date.now() }
    return true
  })
  return { ok: true as const }
}

export function readState() {
  return snapshot
}
