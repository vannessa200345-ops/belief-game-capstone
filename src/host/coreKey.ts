import { DEMO_CARD_LIMIT, demoCardOrder } from '../domain/demoDeck.ts'
import keys from './core-demo-key.json'

/**
 * 主持專用答案。只可由 startRoom 動態 import。
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

/** 只送示範場 core-1…core-12。correct 來自答案欄 Yes／No，小寫。 */
export const HOST_CORE_KEYS: HostCardKey[] = keys.cards
  .filter((card) => demoCardOrder(card.card_id) != null)
  .sort((a, b) => (demoCardOrder(a.card_id) ?? 0) - (demoCardOrder(b.card_id) ?? 0))
  .map((card) => ({
    card_id: card.card_id,
    correct: asChoice(card.correct),
  }))

if (HOST_CORE_KEYS.length !== DEMO_CARD_LIMIT) {
  throw new Error('demo deck must be core-1..core-12')
}

export function hostDeckPayload() {
  return {
    deck_id: keys.deck,
    cards: HOST_CORE_KEYS.map((card) => ({
      card_id: card.card_id,
      correct: card.correct,
    })),
  }
}
