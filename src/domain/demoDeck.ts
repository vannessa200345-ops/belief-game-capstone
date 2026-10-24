/** 這一場示範先走信念原套頭十二句。全文 JSON 仍留在檔案裡。 */
export const DEMO_CARD_LIMIT = 12

export function demoCardOrder(cardId: string): number | null {
  const match = /^core-(\d+)$/.exec(cardId)
  if (!match) return null
  const number = Number(match[1])
  if (!Number.isInteger(number) || number < 1 || number > DEMO_CARD_LIMIT) return null
  return number
}
