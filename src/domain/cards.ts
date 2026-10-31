import { publicAsset } from '@/lib/base.ts'
import { CARD_EN } from './cardEn.ts'
import { DECK_CARD_COUNT } from './constants.ts'
import { MONEY_ZH, RELATIONSHIP_ZH } from './deckText.ts'
import { PUBLIC_CORE, YES_NO_OPTIONS } from './publicDeck.ts'
import type { BeliefCard, DeckId, DeckMeta } from './types.ts'

export { CHOICE_CARD_SRC, CHOICE_FACE_SRC } from './publicDeck.ts'

function withOptions(card: Omit<BeliefCard, 'options'>): BeliefCard {
  return {
    ...card,
    options: YES_NO_OPTIONS.map((option) => ({ ...option })),
  }
}

function faceSrc(deck: DeckId, number: number) {
  return publicAsset(`/cards/${deck}/${String(number).padStart(2, '0')}.jpg`)
}

function textEn(id: string, zh: string) {
  const english = CARD_EN[id]
  if (!english) throw new Error(`missing English card text for ${id}`)
  return english.length > 0 ? english : zh
}

function picturedDeck(
  deck: DeckId,
  theme: string,
  themeEn: string,
  texts: Record<string, string>,
): BeliefCard[] {
  return Array.from({ length: DECK_CARD_COUNT }, (_, index) => {
    const number = index + 1
    const id = `${deck}-${number}`
    const text = texts[id]
    if (!text) throw new Error(`missing card text for ${id}`)
    return withOptions({
      id,
      deck,
      theme,
      themeEn,
      text,
      textEn: textEn(id, text),
      imageSrc: faceSrc(deck, number),
    })
  })
}

const CORE_CARDS: BeliefCard[] = PUBLIC_CORE.map((card, index) =>
  withOptions({
    id: card.id,
    deck: 'core',
    theme: '信念',
    themeEn: 'Belief',
    text: card.text,
    textEn: textEn(card.id, card.text),
    imageSrc: faceSrc('core', index + 1),
  }),
)

const MONEY_CARDS = picturedDeck('money', '金錢', 'Money', MONEY_ZH)
const RELATIONSHIP_CARDS = picturedDeck('relationship', '伴侶', 'Relationship', RELATIONSHIP_ZH)

const BY_DECK: Record<DeckId, BeliefCard[]> = {
  core: CORE_CARDS,
  money: MONEY_CARDS,
  relationship: RELATIONSHIP_CARDS,
}

export const CARDS: BeliefCard[] = CORE_CARDS

const scoredNote = '這一場50張，每張選是或毫無道理。主持開始之後會計分。'
const scoredNoteEn = '50 cards this session. Choose Yes or No on each. Scoring starts when the host begins.'

export const DECKS: DeckMeta[] = [
  {
    id: 'core',
    name: '信念原套',
    nameEn: 'Core beliefs',
    note: scoredNote,
    noteEn: scoredNoteEn,
  },
  {
    id: 'money',
    name: '金錢信念套',
    nameEn: 'Money beliefs',
    note: scoredNote,
    noteEn: scoredNoteEn,
  },
  {
    id: 'relationship',
    name: '伴侶信念',
    nameEn: 'Relationship beliefs',
    note: scoredNote,
    noteEn: scoredNoteEn,
  },
]

/** 三套都有主持答案。學員畫面唔讀 key，只睇伺服器或主持計分返嚟嘅對錯。 */
export function deckHasAnswerKey(id: DeckId): boolean {
  return id === 'core' || id === 'money' || id === 'relationship'
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

export function cardLine(card: BeliefCard, lang: 'zh' | 'en'): string {
  return lang === 'en' ? card.textEn : card.text
}

export function cardTheme(card: BeliefCard, lang: 'zh' | 'en'): string {
  return lang === 'en' ? card.themeEn : card.theme
}

export function optionLabel(cardItem: BeliefCard, optionId: string | null, lang: 'zh' | 'en' = 'zh'): string {
  if (!optionId) return lang === 'en' ? 'Not chosen yet' : '尚未選擇'
  if (optionId === 'yes') return lang === 'en' ? 'Yes' : '是'
  if (optionId === 'no') return lang === 'en' ? 'No' : '毫無道理'
  return cardItem.options.find((option) => option.id === optionId)?.label ?? (lang === 'en' ? 'Not chosen yet' : '尚未選擇')
}
