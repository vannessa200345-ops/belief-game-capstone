export type DeckId = 'core' | 'money' | 'relationship'

export type Phase = 'lobby' | 'playing' | 'paused' | 'revealed' | 'final'

export type Connection = 'connecting' | 'live' | 'reconnecting'

/** unknown：還在探測。live：三個答題 RPC 已可用。missing：PostgREST 404／PGRST202。 */
export type SelfPaceLink = 'unknown' | 'live' | 'missing'

export interface CardOption {
  id: string
  label: string
}

export interface BeliefCard {
  id: string
  deck: DeckId
  theme: string
  themeEn: string
  text: string
  textEn: string
  /** 圖卡路徑，例如 /cards/core/01.jpg。文句留作 alt。 */
  imageSrc: string
  options: CardOption[]
}

export interface DeckMeta {
  id: DeckId
  name: string
  nameEn: string
  note: string
  noteEn: string
}

export interface RoomNote {
  id: string
  playerId: string
  name: string
  text: string
  at: number
  fromHost: boolean
}

export interface Player {
  id: string
  name: string
  demo: boolean
  joinedAt: number
  connected: boolean
  /** 可留空。只用於通知下一場，不是登入。 */
  email?: string | null
  host?: boolean
}

export interface SessionNotice {
  id: string
  name: string
  email: string
  at: number
}

export interface Room {
  code: string
  deck: DeckId
  phase: Phase
  cardIndex: number
  roundStartedAt: number | null
  createdAt: number
}

export interface Answer {
  playerId: string
  cardId: string
  optionId: string
  ms: number
  /** null 代表伺服器還沒核對，不要當成答錯。 */
  correct: boolean | null
}

export interface TimeoutMark {
  playerId: string
  cardId: string
  ms: number
}

export interface SpeakItem {
  id: string
  playerId: string
  requestedAt: number
}

export interface CalledSpeaker {
  playerId: string
  at: number
}

export type BotKind = 'answer' | 'timeout' | 'stuck' | 'queue'

export interface BotPlan {
  playerId: string
  cardId: string
  dueAt: number
  kind: BotKind
  optionId?: string
}

export interface GameState {
  room: Room
  players: Player[]
  youId: string | null
  answers: Answer[]
  timeouts: TimeoutMark[]
  queue: SpeakItem[]
  called: CalledSpeaker | null
  botPlans: BotPlan[]
  /** 留下電郵的人。離開座位後仍保留，直到另開一場。 */
  notices: SessionNotice[]
  /** 這一場嘅文字訊息。唔係電郵，亦唔使開咪。 */
  notes: RoomNote[]
  connection: Connection
  /** 這一頁探測到的答題 RPC。不寫入房間，刷新後再探。 */
  selfPaceLink: SelfPaceLink
  /** 伺服器答題進度。沒有 RPC 時是空的。 */
  remoteAnswered: Record<string, number>
  serverAnswerCount: number
}

export type PersistedState = Omit<GameState, 'connection' | 'selfPaceLink'>

export type AttentionKind = 'timeout' | 'stuck' | 'offline' | 'slow'

export interface AttentionItem {
  playerId: string
  name: string
  kind: AttentionKind
}

export interface RoundMonitor {
  phase: Phase
  card: BeliefCard | null
  cardNumber: number
  cardTotal: number
  answered: number
  unanswered: number
  timeouts: number
  wrong: number
  correct: number
  attention: AttentionItem[]
  attentionExtra: number
  stillQuiet: number
  elapsedMs: number | null
}

export interface CardStat {
  cardId: string
  theme: string
  text: string
  correct: number
  wrong: number
  timeout: number
  missed: number
  avgMs: number | null
  accuracy: number | null
}

export interface PlayerStat {
  playerId: string
  name: string
  demo: boolean
  connected: boolean
  avgMs: number | null
  timeoutCount: number
  missedCount: number
  correctCount: number
  revealedCount: number
}

export interface AnalyticsSnapshot {
  cards: CardStat[]
  players: PlayerStat[]
}

export interface PersonalReview {
  name: string
  total: number
  correct: number
  wrong: number
  timeout: number
  missed: number
  avgMs: number | null
  themes: string[]
}

export type ActionResult = { ok: true } | { ok: false; error: string }

export type JoinResult = ActionResult

export type NoticeEmailResult =
  | { ok: true; email: string | null }
  | { ok: false; error: string }
