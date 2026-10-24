import { DECK_CARD_COUNT } from '../domain/constants.ts'
import type { DeckId } from '../domain/types.ts'
import keys from './core-key.json'

/**
 * 主持專用答案。只可由 startRoom，或本地 mock 計分，動態 import。
 * 不要在學員畫面、public deck，或 update_room_config 引用這個檔。
 * lobby 會把 config 派給在場的人。
 */
export interface HostCardKey {
  card_id: string
  correct: 'yes' | 'no'
}

function asChoice(value: string): 'yes' | 'no' {
  return value === 'yes' ? 'yes' : 'no'
}

function coreOrder(cardId: string): number | null {
  const match = /^core-(\d+)$/.exec(cardId)
  if (!match) return null
  const number = Number(match[1])
  if (!Number.isInteger(number) || number < 1 || number > DECK_CARD_COUNT) return null
  return number
}

/** core-1…core-50。correct 仍是 yes／no：yes 對選擇卡「是」，no 對「毫無道理」。 */
export const HOST_CORE_KEYS: HostCardKey[] = [...keys.cards]
  .sort((a, b) => (coreOrder(a.card_id) ?? 0) - (coreOrder(b.card_id) ?? 0))
  .map((card) => ({
    card_id: card.card_id,
    correct: asChoice(card.correct),
  }))

if (
  HOST_CORE_KEYS.length !== DECK_CARD_COUNT ||
  HOST_CORE_KEYS.some((card, index) => card.card_id !== `core-${index + 1}`)
) {
  throw new Error('core deck must be core-1..core-50')
}

const CORE_CORRECT = new Map(HOST_CORE_KEYS.map((card) => [card.card_id, card.correct]))

/** 沒有這張的答案就回 null，不要當成答錯。 */
export function gradeHostChoice(cardId: string, choiceId: 'yes' | 'no'): boolean | null {
  const correct = CORE_CORRECT.get(cardId)
  if (!correct) return null
  return correct === choiceId
}

/**
 * TODO(money): 未有 money-key.json。不要自擬 correct。
 * TODO(relationship): 未有 relationship-key.json。不要自擬 correct。
 * 有 key 之後再喺呢度回傳同一形狀：{ deck_id, cards: [{ card_id, correct }] }。
 */
export function hostDeckPayload(deckId: DeckId = 'core') {
  if (deckId !== 'core') return null
  return {
    deck_id: keys.deck,
    cards: HOST_CORE_KEYS.map((card) => ({
      card_id: card.card_id,
      correct: card.correct,
    })),
  }
}
