import { cardAt, cardsFor, findCard } from './cards.ts'
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
    const denom = correct + wrong + timeout
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
    const trouble = b.wrong + b.timeout - (a.wrong + a.timeout)
    if (trouble !== 0) return trouble
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
    if (b.timeoutCount !== a.timeoutCount) return b.timeoutCount - a.timeoutCount
    if (b.missedCount !== a.missedCount) return b.missedCount - a.missedCount
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
