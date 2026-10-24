import { cardsFor, findCard } from '../domain/cards.ts'
import type { DeckId, GameState, PersistedState } from '../domain/types.ts'
import type { CardEventRow, LobbySnapshot } from './types.ts'

function asDeck(value: string | null | undefined): DeckId | null {
  if (value === 'core' || value === 'money' || value === 'relationship') return value
  return null
}

function deckFromLobby(lobby: LobbySnapshot, preferred: DeckId): DeckId {
  const ids = [lobby.open_round?.card_id, ...lobby.rounds.map((round) => round.card_id)]
  for (const id of ids) {
    if (!id) continue
    const card = findCard(id)
    if (card) return card.deck
  }
  return asDeck(lobby.deck_id) ?? preferred
}

function stamp(value: string | null | undefined): number {
  if (!value) return Date.now()
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? Date.now() : parsed
}

function cardIndexOf(deck: DeckId, cardId: string | undefined, roundIndex: number): number {
  if (!cardId) return 0
  const card = findCard(cardId)
  if (!card || card.deck !== deck) return Math.max(0, roundIndex - 1)
  const index = cardsFor(deck).findIndex((item) => item.id === cardId)
  return index >= 0 ? index : Math.max(0, roundIndex - 1)
}

export function mapLobby(
  lobby: LobbySnapshot,
  events: CardEventRow[],
  called: GameState['called'],
  preferred: DeckId,
): PersistedState {
  const deck = deckFromLobby(lobby, preferred)
  const open = lobby.open_round
  const ordered = [...(lobby.rounds ?? [])].sort((a, b) => a.round_index - b.round_index)
  const revealed = ordered.filter((round) => round.revealed_at != null)
  const active = open ?? revealed[revealed.length - 1] ?? ordered[ordered.length - 1] ?? null
  const ended = lobby.status === 'ended' || lobby.ended_at != null
  const phase = ended
    ? 'final'
    : lobby.status === 'paused'
      ? 'paused'
      : lobby.status === 'lobby'
        ? 'lobby'
        : 'playing'
  const you = lobby.you

  const seen = new Set<string>()
  const answers = []
  for (const event of events) {
    const key = `${event.player_id}:${event.card_id}`
    if (seen.has(key)) continue
    seen.add(key)
    answers.push({
      playerId: event.player_id,
      cardId: event.card_id,
      optionId: event.choice_id,
      ms: event.time_ms ?? 0,
      correct: event.is_correct === true ? true : event.is_correct === false ? false : null,
    })
  }

  return {
    room: {
      code: lobby.code,
      deck,
      phase,
      cardIndex: active ? cardIndexOf(deck, active.card_id, active.round_index) : -1,
      roundStartedAt: phase === 'playing' && open ? stamp(open.started_at) : null,
      createdAt: stamp(lobby.created_at),
    },
    players: (lobby.players ?? [])
      .filter((player) => player.left_at == null)
      .map((player) => ({
        id: player.player_id,
        name: player.display_name,
        demo: false,
        joinedAt: stamp(player.joined_at),
        connected: true,
        host: player.is_host,
        email: player.player_id === you.player_id ? you.email : null,
      })),
    youId: you.player_id,
    answers,
    timeouts: [],
    queue: [...(lobby.speak_queue ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        id: item.id,
        playerId: item.player_id,
        requestedAt: stamp(item.enqueued_at),
      })),
    called,
    botPlans: [],
    notices: you.email
      ? [{ id: 'you-notice', name: you.display_name, email: you.email, at: Date.now() }]
      : [],
    remoteAnswered: {},
    serverAnswerCount: lobby.answer_count ?? 0,
  }
}
