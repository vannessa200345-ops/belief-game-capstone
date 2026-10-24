/** 舊示範只取頭十二句。房間而家用全套 50 張，見 cards.ts。這個 helper 只對照當初的 core-demo JSON。 */
export const DEMO_CARD_LIMIT = 12

export function demoCardOrder(cardId: string): number | null {
  const match = /^core-(\d+)$/.exec(cardId)
  if (!match) return null
  const number = Number(match[1])
  if (!Number.isInteger(number) || number < 1 || number > DEMO_CARD_LIMIT) return null
  return number
}
