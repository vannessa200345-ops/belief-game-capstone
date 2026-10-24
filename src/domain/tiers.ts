/** 暫定分階，只供個人整理顯示。房內排名另計答中題數。 */
export function scoreTier(correct: number, total: number): string | null {
  if (total <= 0) return null
  const ratio = correct / total
  if (ratio >= 0.9) return '成仙'
  if (ratio >= 0.75) return '行家'
  if (ratio >= 0.6) return '學徒'
  return '平民'
}
