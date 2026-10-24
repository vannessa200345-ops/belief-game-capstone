import { DECK_CARD_COUNT } from './constants.ts'
import { PUBLIC_CORE, YES_NO_OPTIONS } from './publicDeck.ts'
import type { BeliefCard, DeckId, DeckMeta } from './types.ts'

export { CHOICE_CARD_SRC } from './publicDeck.ts'

function withOptions(card: Omit<BeliefCard, 'options'>): BeliefCard {
  return {
    ...card,
    options: YES_NO_OPTIONS.map((option) => ({ ...option })),
  }
}

function faceSrc(deck: DeckId, number: number) {
  return `/cards/${deck}/${String(number).padStart(2, '0')}.jpg`
}

function picturedDeck(deck: DeckId, theme: string, label: string): BeliefCard[] {
  return Array.from({ length: DECK_CARD_COUNT }, (_, index) => {
    const number = index + 1
    return withOptions({
      id: `${deck}-${number}`,
      deck,
      theme,
      text: `${label}第 ${number} 張`,
      imageSrc: faceSrc(deck, number),
    })
  })
}

const CORE_CARDS: BeliefCard[] = PUBLIC_CORE.map((card, index) =>
  withOptions({
    id: card.id,
    deck: 'core',
    theme: '信念',
    text: card.text,
    imageSrc: faceSrc('core', index + 1),
  }),
)

/**
 * TODO(money): 金錢信念套未有 src/host 答案 key，亦未有公開文句。
 * 先顯示 /cards/money/01.jpg…50.jpg，不要在這裡寫正確方向。
 * TODO(relationship): 伴侶信念同上，圖在 /cards/relationship/。
 */
const MONEY_CARDS = picturedDeck('money', '金錢', '金錢信念')
const RELATIONSHIP_CARDS = picturedDeck('relationship', '伴侶', '伴侶信念')

const BY_DECK: Record<DeckId, BeliefCard[]> = {
  core: CORE_CARDS,
  money: MONEY_CARDS,
  relationship: RELATIONSHIP_CARDS,
}

export const CARDS: BeliefCard[] = CORE_CARDS

export const DECKS: DeckMeta[] = [
  { id: 'core', name: '信念原套', note: `這一場${CORE_CARDS.length}張，每張選是或毫無道理。` },
  {
    id: 'money',
    name: '金錢信念套',
    note: `這一場${DECK_CARD_COUNT}張圖卡。參考答案未放入，暫時不計分。`,
  },
  {
    id: 'relationship',
    name: '伴侶信念',
    note: `這一場${DECK_CARD_COUNT}張圖卡。參考答案未放入，暫時不計分。`,
  },
]

/** 只有信念原套有主持答案。金錢、伴侶 key 未進 repo 時不要當成已可計分。 */
export function deckHasAnswerKey(id: DeckId): boolean {
  return id === 'core'
}

export function deckMeta(id: DeckId): DeckMeta {
  return DECKS.find((deck) => deck.id === id) ?? DECKS[0]
}

export function cardsFor(deck?: DeckId): BeliefCard[] {
  if (!deck) return CORE_CARDS
  return BY_DECK[deck] ?? CORE_CARDS
}

export function cardAt(deck: DeckId, index: number): BeliefCard | null {
  return cardsFor(deck)[index] ?? null
}

export function findCard(id: string): BeliefCard | null {
  for (const deck of Object.values(BY_DECK)) {
    const found = deck.find((card) => card.id === id)
    if (found) return found
  }
  return null
}

export function optionLabel(cardItem: BeliefCard, optionId: string | null): string {
  if (!optionId) return '尚未選擇'
  return cardItem.options.find((option) => option.id === optionId)?.label ?? '尚未選擇'
}
