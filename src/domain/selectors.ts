import { cardAt, cardsFor, deckHasAnswerKey, findCard } from './cards.ts'
import { playOrder } from './order.ts'
import { MAX_ATTENTION, SLOW_MS } from './constants.ts'
import type {
  AnalyticsSnapshot,
  AttentionItem,
  BeliefCard,
  CardStat,
  GameState,
  PersonalReview,
  Player,
  PlayerStat,
  RoundMonitor,
} from './types.ts'

export function youPlayer(state: GameState): Player | null {
  if (!state.youId) return null
  return state.players.find((player) => player.id === state.youId) ?? null
}

export function currentCard(state: GameState): BeliefCard | null {
  if (state.room.phase === 'lobby') return null
  return cardAt(state.room.deck, state.room.cardIndex)
}

export function revealedCards(state: GameState): BeliefCard[] {
  const all = cardsFor(state.room.deck)
  if (state.room.phase === 'lobby') return []
  if (state.room.phase === 'final') return all
  const answered = new Set(state.answers.map((answer) => answer.cardId))
  return all.filter((card) => answered.has(card.id))
}

export function playerName(state: GameState, playerId: string): string {
  return state.players.find((player) => player.id === playerId)?.name ?? '已離開'
}

export function yourAnswer(state: GameState, cardId: string) {
  if (!state.youId) return null
  return state.answers.find((answer) => answer.playerId === state.youId && answer.cardId === cardId) ?? null
}

export function yourQueuePosition(state: GameState): number | null {
  if (!state.youId) return null
  const index = state.queue.findIndex((item) => item.playerId === state.youId)
  return index === -1 ? null : index + 1
}

export function selectMonitor(state: GameState, now = Date.now()): RoundMonitor {
  const card = currentCard(state)
  const total = cardsFor(state.room.deck).length
  const elapsedMs =
    state.room.phase === 'playing' && state.room.roundStartedAt != null
      ? Math.max(0, now - state.room.roundStartedAt)
      : null

  if (!card) {
    const offline = state.players
      .filter((player) => !player.connected)
      .map((player) => ({ playerId: player.id, name: player.name, kind: 'offline' as const }))
    return {
      phase: state.room.phase,
      card: null,
      cardNumber: 0,
      cardTotal: total,
      answered: 0,
      unanswered: 0,
      timeouts: 0,
      wrong: 0,
      correct: 0,
      attention: offline.slice(0, MAX_ATTENTION),
      attentionExtra: Math.max(0, offline.length - MAX_ATTENTION),
      stillQuiet: 0,
      elapsedMs: null,
    }
  }

  const answers = state.answers.filter((answer) => answer.cardId === card.id)
  const timeoutIds = new Set(
    state.timeouts.filter((mark) => mark.cardId === card.id).map((mark) => mark.playerId),
  )
  const answeredIds = new Set(answers.map((answer) => answer.playerId))
  const present = state.players
  const unansweredPlayers = present.filter(
    (player) => player.connected && !answeredIds.has(player.id) && !timeoutIds.has(player.id),
  )

  const attention: AttentionItem[] = []
  for (const player of present) {
    if (!player.connected) {
      attention.push({ playerId: player.id, name: player.name, kind: 'offline' })
      continue
    }
    if (timeoutIds.has(player.id)) {
      attention.push({ playerId: player.id, name: player.name, kind: 'timeout' })
      continue
    }
    if (answeredIds.has(player.id)) continue
    const stuck = state.botPlans.some(
      (plan) => plan.playerId === player.id && plan.cardId === card.id && plan.kind === 'stuck',
    )
    if (stuck) {
      attention.push({ playerId: player.id, name: player.name, kind: 'stuck' })
      continue
    }
    if (elapsedMs != null && elapsedMs >= SLOW_MS) {
      attention.push({ playerId: player.id, name: player.name, kind: 'slow' })
    }
  }

  const order = { offline: 0, timeout: 1, stuck: 2, slow: 3 }
  attention.sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name, 'zh-Hant'))

  const correct = answers.filter((answer) => answer.correct === true).length
  const wrong = answers.filter((answer) => answer.correct === false).length
  const listedIds = new Set(attention.map((item) => item.playerId))
  const stillQuiet = unansweredPlayers.filter((player) => !listedIds.has(player.id)).length

  return {
    phase: state.room.phase,
    card,
    cardNumber: state.room.cardIndex + 1,
    cardTotal: total,
    answered: answers.length,
    unanswered: unansweredPlayers.length,
    timeouts: timeoutIds.size,
    wrong,
    correct,
    attention: attention.slice(0, MAX_ATTENTION),
    attentionExtra: Math.max(0, attention.length - MAX_ATTENTION),
    stillQuiet,
    elapsedMs,
  }
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function selectAnalytics(state: GameState): AnalyticsSnapshot {
  const revealed = revealedCards(state)
  const cards: CardStat[] = revealed.map((card) => {
    const answers = state.answers.filter((answer) => answer.cardId === card.id)
    const timeout = state.timeouts.filter((mark) => mark.cardId === card.id).length
    const correct = answers.filter((answer) => answer.correct === true).length
    const wrong = answers.filter((answer) => answer.correct === false).length
    const touched = new Set<string>([
      ...answers.map((answer) => answer.playerId),
      ...state.timeouts.filter((mark) => mark.cardId === card.id).map((mark) => mark.playerId),
    ])
    const missed = state.players.filter((player) => player.connected && !touched.has(player.id)).length
    const denom = correct + wrong
    return {
      cardId: card.id,
      theme: card.theme,
      text: card.text,
      correct,
      wrong,
      timeout,
      missed,
      avgMs: average(answers.map((answer) => answer.ms)),
      accuracy: denom === 0 ? null : correct / denom,
    }
  })

  cards.sort((a, b) => {
    if (b.wrong !== a.wrong) return b.wrong - a.wrong
    return b.missed - a.missed
  })

  const players: PlayerStat[] = state.players.map((player) => {
    const answers = state.answers.filter(
      (answer) => answer.playerId === player.id && revealed.some((card) => card.id === answer.cardId),
    )
    const timeoutCount = state.timeouts.filter(
      (mark) => mark.playerId === player.id && revealed.some((card) => card.id === mark.cardId),
    ).length
    const missedCount = revealed.filter((card) => {
      const answered = answers.some((answer) => answer.cardId === card.id)
      const timedOut = state.timeouts.some(
        (mark) => mark.playerId === player.id && mark.cardId === card.id,
      )
      return !answered && !timedOut
    }).length
    return {
      playerId: player.id,
      name: player.name,
      demo: player.demo,
      connected: player.connected,
      avgMs: average(answers.map((answer) => answer.ms)),
      timeoutCount,
      missedCount,
      correctCount: answers.filter((answer) => answer.correct === true).length,
      revealedCount: revealed.length,
    }
  })

  players.sort((a, b) => {
    if (b.missedCount !== a.missedCount) return b.missedCount - a.missedCount
    const aMs = a.avgMs ?? -1
    const bMs = b.avgMs ?? -1
    if (bMs !== aMs) return bMs - aMs
    return a.name.localeCompare(b.name, 'zh-Hant')
  })

  return { cards, players }
}

export function selectPersonal(state: GameState): PersonalReview | null {
  const you = youPlayer(state)
  if (!you) return null
  const snapshot = selectAnalytics(state)
  const mine = snapshot.players.find((player) => player.playerId === you.id)
  if (!mine) return null

  const themeCounts = new Map<string, number>()
  for (const card of revealedCards(state)) {
    const answer = yourAnswer(state, card.id)
    const timedOut = state.timeouts.some((mark) => mark.playerId === you.id && mark.cardId === card.id)
    if (answer?.correct !== false && !timedOut) continue
    themeCounts.set(card.theme, (themeCounts.get(card.theme) ?? 0) + 1)
  }
  const themes = [...themeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([theme]) => theme)

  return {
    name: you.name,
    total: mine.revealedCount,
    correct: mine.correctCount,
    wrong: state.answers.filter((answer) => answer.playerId === you.id && answer.correct === false).length,
    timeout: mine.timeoutCount,
    missed: mine.missedCount,
    avgMs: mine.avgMs,
    themes,
  }
}

export interface PaceRow {
  playerId: string
  name: string
  host: boolean
  connected: boolean
  answered: number
  done: boolean
  stuck: boolean
}

export function selectPaceBoard(state: GameState) {
  const total = cardsFor(state.room.deck).length
  const perPlayer = new Map<string, Set<string>>()
  for (const answer of state.answers) {
    const cards = perPlayer.get(answer.playerId) ?? new Set<string>()
    cards.add(answer.cardId)
    perPlayer.set(answer.playerId, cards)
  }

  const rows: PaceRow[] = state.players.map((player) => {
    const local = perPlayer.get(player.id)?.size ?? 0
    const remote = state.remoteAnswered[player.id] ?? 0
    const answered = Math.min(total, Math.max(local, remote))
    return {
      playerId: player.id,
      name: player.name,
      host: Boolean(player.host),
      connected: player.connected,
      answered,
      done: total > 0 && answered >= total,
      stuck: false,
    }
  })

  const learners = rows.filter((row) => !row.host)
  const leading = learners.reduce((max, row) => Math.max(max, row.answered), 0)
  const anyProgress = leading > 0 || state.serverAnswerCount > 0
  for (const row of rows) {
    if (row.host || row.done) continue
    if (!row.connected || (anyProgress && leading >= 3 && leading - row.answered >= 3)) {
      row.stuck = true
    }
  }

  return {
    total,
    rows,
    finished: learners.filter((row) => row.done).length,
    learners: learners.length,
  }
}

export function cardById(id: string): BeliefCard | null {
  return findCard(id)
}

/** 只帶這一場已核對的對錯，用來計分。不要把選項 id 傳進來。 */
export interface PaceGrade {
  cardId: string
  isCorrect: boolean | null
}

export interface LeaderRow {
  playerId: string
  name: string
  you: boolean
  correct: number
  rank: number
}

export interface LeaderboardSnapshot {
  /** false：這套未有參考答案，不要把 0 分當成排名。 */
  keyed: boolean
  rows: LeaderRow[]
  you: LeaderRow | null
}

function gradesFor(state: GameState, playerId: string, yours: PaceGrade[] | undefined) {
  const byCard = new Map<string, boolean | null>()
  for (const answer of state.answers) {
    if (answer.playerId !== playerId) continue
    byCard.set(answer.cardId, answer.correct)
  }
  if (playerId === state.youId && yours) {
    for (const grade of yours) {
      const previous = byCard.get(grade.cardId)
      if (previous === undefined || grade.isCorrect !== null) byCard.set(grade.cardId, grade.isCorrect)
    }
  }
  let correct = 0
  for (const value of byCard.values()) {
    if (value === true) correct += 1
  }
  return correct
}

/**
 * 這一場排名。只用答中題數，不讀主持答案 key，也不列出邊張選了甚麼。
 * 主持同示範學員不入榜。
 */
export function selectLeaderboard(state: GameState, yours?: PaceGrade[]): LeaderboardSnapshot {
  const keyed = deckHasAnswerKey(state.room.deck)
  if (!keyed) return { keyed: false, rows: [], you: null }

  const scored = state.players
    .filter((player) => !player.host && !player.demo)
    .map((player) => ({
      playerId: player.id,
      name: player.name,
      you: player.id === state.youId,
      correct: gradesFor(state, player.id, yours),
      rank: 0,
    }))
    .sort((a, b) => {
      if (b.correct !== a.correct) return b.correct - a.correct
      return a.name.localeCompare(b.name, 'zh-Hant')
    })

  let lastCorrect = -1
  let rank = 0
  scored.forEach((row, index) => {
    if (row.correct !== lastCorrect) {
      rank = index + 1
      lastCorrect = row.correct
    }
    row.rank = rank
  })

  return {
    keyed: true,
    rows: scored,
    you: scored.find((row) => row.you) ?? null,
  }
}

export interface CardWaveBar {
  cardId: string
  number: number
  correct: number
  wrong: number
}

export interface CardWaveSnapshot {
  /** false：這套未有參考答案，不要畫成全員答錯。 */
  keyed: boolean
  bars: CardWaveBar[]
  peak: number
}

/**
 * 每一張的答中／答錯人數。只計已核對的結果，不記邊個選項，也不讀答案 key。
 * yours 只覆蓋你自己，等交答後條形可以先郁，其他人靠房間紀錄。
 */
export function selectCardWaves(state: GameState, yours?: PaceGrade[]): CardWaveSnapshot {
  const cards = playOrder(state.room.deck, state.room.code)
  if (!deckHasAnswerKey(state.room.deck)) return { keyed: false, bars: [], peak: 1 }

  const cell = new Map<string, Map<string, boolean>>()
  const put = (playerId: string, cardId: string, value: boolean | null) => {
    if (value !== true && value !== false) return
    const row = cell.get(cardId) ?? new Map<string, boolean>()
    row.set(playerId, value)
    cell.set(cardId, row)
  }
  for (const answer of state.answers) put(answer.playerId, answer.cardId, answer.correct)
  if (state.youId && yours) {
    for (const grade of yours) put(state.youId, grade.cardId, grade.isCorrect)
  }

  const bars = cards.map((card, index) => {
    const row = cell.get(card.id)
    let correct = 0
    let wrong = 0
    if (row) {
      for (const value of row.values()) {
        if (value) correct += 1
        else wrong += 1
      }
    }
    return { cardId: card.id, number: index + 1, correct, wrong }
  })
  const peak = bars.reduce((max, bar) => Math.max(max, bar.correct, bar.wrong), 1)
  return { keyed: true, bars, peak }
}

export interface CardAnswerRow {
  playerId: string
  name: string
  left: boolean
  demo: boolean
  optionId: string
  /** null：有選擇，但還沒同參考方向核對。 */
  correct: boolean | null
  seconds: number
  /** 呢張入面用時最短。至少兩個人、而且秒數有分別先會標。 */
  fastest: boolean
  /** 呢張入面用時最長。同最快一樣，唔會扣分。 */
  slowest: boolean
}

/**
 * 呢一張卡、呢一場嘅逐人紀錄。用已儲存嘅選擇、核對同用時，不再計一次分。
 * 未作答嘅人不入表。次序由用時短到長。
 */
export function selectCardAnswers(state: GameState, cardId: string): CardAnswerRow[] {
  const latest = new Map<string, { optionId: string; correct: boolean | null; ms: number }>()
  for (const answer of state.answers) {
    if (answer.cardId !== cardId) continue
    latest.set(answer.playerId, {
      optionId: answer.optionId,
      correct: answer.correct,
      ms: answer.ms,
    })
  }

  const rows: CardAnswerRow[] = []
  for (const [playerId, answer] of latest) {
    const player = state.players.find((item) => item.id === playerId)
    rows.push({
      playerId,
      name: player?.name ?? '',
      left: !player,
      demo: player?.demo ?? false,
      optionId: answer.optionId,
      correct: answer.correct,
      seconds: Math.max(0, Math.round(answer.ms / 1000)),
      fastest: false,
      slowest: false,
    })
  }

  const min = rows.reduce((low, row) => Math.min(low, row.seconds), Number.POSITIVE_INFINITY)
  const max = rows.reduce((high, row) => Math.max(high, row.seconds), Number.NEGATIVE_INFINITY)
  const comparable = rows.length >= 2 && min !== max
  if (comparable) {
    for (const row of rows) {
      row.fastest = row.seconds === min
      row.slowest = row.seconds === max
    }
  }
  rows.sort((a, b) => a.seconds - b.seconds || a.name.localeCompare(b.name, 'zh-Hant'))
  return rows
}

export interface TimedPoint {
  id: string
  name: string
  left: boolean
  /** 卡嘅話係呢一場打亂後嘅次序。人就係 0。 */
  number: number
  avgSeconds: number
  answers: number
}

export interface SessionTimeBar {
  id: string
  /** 呢一場打亂後嘅次序，由 1 起。 */
  number: number
  avgSeconds: number
  answers: number
  /** 有用時嘅卡入面平均最短，而且同最長唔同秒。未作答唔會標。 */
  mostSure: boolean
  /** 有用時嘅卡入面平均最長。同最短一樣，只係分析，唔會扣分。 */
  mostHesitant: boolean
}

export interface SessionTimeGlance {
  /** 呢一場次序。未作答嘅卡都在，answers 係 0，方便同答中條形對位。 */
  bars: SessionTimeBar[]
  /** 呢場已儲存用時入面，最高嘅平均秒數。未有就係 0。 */
  peakSeconds: number
  shortestCard: TimedPoint | null
  longestCard: TimedPoint | null
  fastestPerson: TimedPoint | null
  slowestPerson: TimedPoint | null
  cardsWithTime: number
  peopleWithTime: number
}

function averageSeconds(values: number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0)
  return Math.max(0, Math.round(total / values.length / 1000))
}

/**
 * 呢一場用時概覽。最短係最有把握，最長係最猶豫。
 * 只用呢場已儲存嘅每張用時，唔讀其他場，亦唔當係扣分。
 */
export function selectSessionTime(state: GameState): SessionTimeGlance {
  const order = playOrder(state.room.deck, state.room.code)
  const byCard = new Map<string, number[]>()
  const byPerson = new Map<string, number[]>()
  for (const answer of state.answers) {
    const cardTimes = byCard.get(answer.cardId) ?? []
    cardTimes.push(answer.ms)
    byCard.set(answer.cardId, cardTimes)
    const personTimes = byPerson.get(answer.playerId) ?? []
    personTimes.push(answer.ms)
    byPerson.set(answer.playerId, personTimes)
  }

  const cards: TimedPoint[] = []
  order.forEach((card, index) => {
    const times = byCard.get(card.id)
    if (!times || times.length === 0) return
    cards.push({
      id: card.id,
      name: '',
      left: false,
      number: index + 1,
      avgSeconds: averageSeconds(times),
      answers: times.length,
    })
  })

  const people: TimedPoint[] = []
  for (const [playerId, times] of byPerson) {
    const player = state.players.find((item) => item.id === playerId)
    people.push({
      id: playerId,
      name: player?.name ?? '',
      left: !player,
      number: 0,
      avgSeconds: averageSeconds(times),
      answers: times.length,
    })
  }

  const shortestCard = extreme(cards, 'min')
  const longestCard = extreme(cards, 'max')
  const bars: SessionTimeBar[] = order.map((card, index) => {
    const times = byCard.get(card.id)
    const answers = times?.length ?? 0
    const avgSeconds = times && times.length > 0 ? averageSeconds(times) : 0
    return {
      id: card.id,
      number: index + 1,
      avgSeconds,
      answers,
      mostSure: Boolean(shortestCard && answers > 0 && avgSeconds === shortestCard.avgSeconds),
      mostHesitant: Boolean(longestCard && answers > 0 && avgSeconds === longestCard.avgSeconds),
    }
  })
  const peakSeconds = bars.reduce((max, bar) => Math.max(max, bar.avgSeconds), 0)

  return {
    bars,
    peakSeconds,
    shortestCard,
    longestCard,
    fastestPerson: extreme(people, 'min'),
    slowestPerson: extreme(people, 'max'),
    cardsWithTime: cards.length,
    peopleWithTime: people.length,
  }
}

function extreme(points: TimedPoint[], which: 'min' | 'max'): TimedPoint | null {
  if (points.length < 2) return null
  const seconds = points.map((point) => point.avgSeconds)
  const target = which === 'min' ? Math.min(...seconds) : Math.max(...seconds)
  if (Math.min(...seconds) === Math.max(...seconds)) return null
  const tied = points.filter((point) => point.avgSeconds === target)
  tied.sort((a, b) => a.number - b.number || a.name.localeCompare(b.name, 'zh-Hant'))
  return tied[0] ?? null
}
