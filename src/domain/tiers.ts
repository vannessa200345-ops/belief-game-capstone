/**
 * 分階顏色未有產品決定，畫面唔好呼叫。
 * 房內排名只計呢一場答中題數。
 */
export function scoreTier(correct: number, total: number): string | null {
  if (total <= 0) return null
  const ratio = correct / total
  if (ratio >= 0.9) return '成仙'
  if (ratio >= 0.75) return '行家'
  if (ratio >= 0.6) return '學徒'
  return '平民'
}
