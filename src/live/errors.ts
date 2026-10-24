export function explain(error: unknown): string {
  const record = typeof error === 'object' && error != null ? (error as { hint?: unknown; message?: unknown }) : null
  const hint = typeof record?.hint === 'string' ? record.hint : ''
  const message = typeof record?.message === 'string' ? record.message : error instanceof Error ? error.message : ''
  const code = `${hint} ${message}`
  if (code.includes('room_not_found')) return '找不到這個房間。請再對一次房間碼。'
  if (code.includes('room_full')) return '這個房間已滿三十人。'
  if (code.includes('not_host')) return '只有主持可以做這一步。'
  if (code.includes('not_in_room')) return '你已經不在這一場裡。'
  if (code.includes('not_authenticated')) return '未能建立匿名身份。請再試一次。'
  if (code.includes('invalid_display_name')) return '名字請保持在三十二個字以內，且不要留空。'
  if (code.includes('invalid_email')) return '電郵看起來不完整。可以留空，或再檢查一次。'
  if (code.includes('invalid_state')) return '這一刻還不能做這一步。已結束的房間不能再加入。'
  if (code.includes('Failed to fetch') || code.includes('NetworkError') || code.includes('網絡')) {
    return '連不上房間。請稍後再試。'
  }
  return '暫時未能完成。請再試一次。'
}
