import type { BeliefCard, DeckId, DeckMeta } from './types.ts'
import { PUBLIC_CORE, YES_NO_OPTIONS } from './publicDeck.ts'

function toCard(id: string, text: string): BeliefCard {
  return {
    id,
    deck: 'core',
    theme: '信念',
    text,
    options: YES_NO_OPTIONS.map((option) => ({ ...option })),
  }
}

/** 信念原套全文。其他牌套名稱不會再換上另一套文句。 */
export const CARDS: BeliefCard[] = PUBLIC_CORE.map((card) => toCard(card.id, card.text))

export const DECKS: DeckMeta[] = [
  { id: 'core', name: '信念原套', note: `這一場${CARDS.length}句，每句只選是或否。` },
]

export function deckMeta(id: DeckId): DeckMeta {
  return DECKS.find((deck) => deck.id === id) ?? DECKS[0]
}

export function cardsFor(_deck?: DeckId): BeliefCard[] {
  return CARDS
}

export function cardAt(_deck: DeckId, index: number): BeliefCard | null {
  return CARDS[index] ?? null
}

export function findCard(id: string): BeliefCard | null {
  return CARDS.find((cardItem) => cardItem.id === id) ?? null
}

export function optionLabel(cardItem: BeliefCard, optionId: string | null): string {
  if (!optionId) return '尚未選擇'
  return cardItem.options.find((option) => option.id === optionId)?.label ?? '尚未選擇'
}
