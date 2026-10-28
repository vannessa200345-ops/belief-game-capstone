import { publicAsset } from '@/lib/base.ts'
import { DECK_CARD_COUNT } from './constants.ts'
import type { CardOption } from './types.ts'
import deck from './core-public.json'

/** 學員畫面只得文句。正確方向不在這個檔。 */
export interface PublicCard {
  id: string
  text: string
}

/**
 * 選項 id 維持 yes／no，跟 src/host 答案 key 同 submit_self_paced 一致。
 * 字樣跟選擇卡本身：是／YES、毫無道理／NO。
 */
export const YES_NO_OPTIONS: CardOption[] = [
  { id: 'yes', label: '是／YES' },
  { id: 'no', label: '毫無道理／NO' },
]

/** 選擇圖。完整卡圖留底；按鈕只用裁走卡框嘅角色面。 */
export const CHOICE_CARD_SRC = {
  yes: publicAsset('/choices/yes.jpg'),
  no: publicAsset('/choices/no.jpg'),
} as const

export const CHOICE_FACE_SRC = {
  yes: publicAsset('/choices/yes-face.jpg'),
  no: publicAsset('/choices/no-face.jpg'),
} as const

function coreOrder(cardId: string): number | null {
  const match = /^core-(\d+)$/.exec(cardId)
  if (!match) return null
  const number = Number(match[1])
  if (!Number.isInteger(number) || number < 1 || number > DECK_CARD_COUNT) return null
  return number
}

/** 信念原套 core-1…core-50 的牌文。正確方向不在這裡。 */
export const PUBLIC_CORE: PublicCard[] = [...deck.cards]
  .sort((a, b) => (coreOrder(a.card_id) ?? 0) - (coreOrder(b.card_id) ?? 0))
  .map((card) => ({
    id: card.card_id,
    text: card.text,
  }))

if (
  PUBLIC_CORE.length !== DECK_CARD_COUNT ||
  PUBLIC_CORE.some((card, index) => card.id !== `core-${index + 1}` || card.text.length === 0)
) {
  throw new Error('core deck must be core-1..core-50')
}
