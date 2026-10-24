import { DEMO_CARD_LIMIT, demoCardOrder } from './demoDeck.ts'
import type { CardOption } from './types.ts'
import deck from './core-demo-public.json'

/** 學員畫面只得文句。正確方向不在這個檔。 */
export interface PublicCard {
  id: string
  text: string
}

export const YES_NO_OPTIONS: CardOption[] = [
  { id: 'yes', label: '是／YES' },
  { id: 'no', label: '否／NO' },
]

/** 示範場 core-1…core-12 的牌文。正確方向不在這裡。 */
export const PUBLIC_CORE: PublicCard[] = deck.cards
  .filter((card) => demoCardOrder(card.card_id) != null)
  .sort((a, b) => (demoCardOrder(a.card_id) ?? 0) - (demoCardOrder(b.card_id) ?? 0))
  .map((card) => ({
    id: card.card_id,
    text: card.text,
  }))

if (PUBLIC_CORE.length !== DEMO_CARD_LIMIT) {
  throw new Error('demo deck must be core-1..core-12')
}
