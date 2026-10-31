import { DECK_CARD_COUNT } from '../domain/constants.ts'
import { playOrderIds } from '../domain/order.ts'
import type { DeckId } from '../domain/types.ts'
import coreKeys from './core-key.json'
import moneyKeys from './money-key.json'
import relationshipKeys from './relationship-key.json'

/**
 * 主持專用答案。只可由 startRoom，或本地 mock 計分，動態 import。
 * 不要在學員畫面、public deck，或 update_room_config 引用這個檔。
 * lobby 會把 config 派給在場的人。
 */
export interface HostCardKey {
  card_id: string
  correct: 'yes' | 'no'
}

interface KeyFile {
  deck: string
  cards: { card_id: string; correct: string }[]
}

function asChoice(value: string): 'yes' | 'no' {
  return value === 'yes' ? 'yes' : 'no'
}

function deckOrder(cardId: string, prefix: DeckId): number | null {
  const match = new RegExp(`^${prefix}-(\\d+)$`).exec(cardId)
  if (!match?.[1]) return null
  const number = Number(match[1])
  if (!Number.isInteger(number) || number < 1 || number > DECK_CARD_COUNT) return null
  return number
}

function loadDeck(file: KeyFile, prefix: DeckId): HostCardKey[] {
  const cards = [...file.cards]
    .sort((a, b) => (deckOrder(a.card_id, prefix) ?? 0) - (deckOrder(b.card_id, prefix) ?? 0))
    .map((card) => ({
      card_id: card.card_id,
      correct: asChoice(card.correct),
    }))
  if (
    file.deck !== prefix ||
    cards.length !== DECK_CARD_COUNT ||
    cards.some((card, index) => card.card_id !== `${prefix}-${index + 1}`)
  ) {
    throw new Error(`${prefix} deck must be ${prefix}-1..${prefix}-${DECK_CARD_COUNT}`)
  }
  return cards
}

export const HOST_CORE_KEYS = loadDeck(coreKeys, 'core')
const HOST_MONEY_KEYS = loadDeck(moneyKeys, 'money')
const HOST_RELATIONSHIP_KEYS = loadDeck(relationshipKeys, 'relationship')

const BY_DECK: Record<DeckId, HostCardKey[]> = {
  core: HOST_CORE_KEYS,
  money: HOST_MONEY_KEYS,
  relationship: HOST_RELATIONSHIP_KEYS,
}

const CORRECT = new Map<string, 'yes' | 'no'>(
  [...HOST_CORE_KEYS, ...HOST_MONEY_KEYS, ...HOST_RELATIONSHIP_KEYS].map((card) => [card.card_id, card.correct]),
)

/** 沒有這張的答案就回 null，不要當成答錯。 */
export function gradeHostChoice(cardId: string, choiceId: 'yes' | 'no'): boolean | null {
  const correct = CORRECT.get(cardId)
  if (!correct) return null
  return correct === choiceId
}

/** 三套同一形狀。有房間碼就跟學員畫面同一個打亂次序交俾 start_self_paced。 */
export function hostDeckPayload(deckId: DeckId = 'core', roomCode = '') {
  const cards = BY_DECK[deckId]
  if (!cards) return null
  const order = playOrderIds(deckId, roomCode)
  const byId = new Map(cards.map((card) => [card.card_id, card.correct]))
  return {
    deck_id: deckId,
    cards: order.map((cardId) => {
      const correct = byId.get(cardId)
      if (!correct) throw new Error(`missing key for ${cardId}`)
      return { card_id: cardId, correct }
    }),
  }
}
