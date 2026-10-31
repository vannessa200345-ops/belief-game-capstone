import { tx } from '../i18n/text.ts'

export function explain(error: unknown): string {
  const record = typeof error === 'object' && error != null ? (error as { hint?: unknown; message?: unknown }) : null
  const hint = typeof record?.hint === 'string' ? record.hint : ''
  const message = typeof record?.message === 'string' ? record.message : error instanceof Error ? error.message : ''
  const code = `${hint} ${message}`
  if (code.includes('room_not_found')) return tx('找不到這個房間。請再對一次房間碼。', 'That room was not found. Check the room code.')
  if (code.includes('room_full')) return tx('這個房間已滿三十人。', 'This room is full at thirty people.')
  if (code.includes('not_host')) return tx('只有主持可以做這一步。', 'Only the host can do that.')
  if (code.includes('not_in_room')) return tx('你已經不在這一場裡。', 'You are no longer in this session.')
  if (code.includes('not_authenticated')) return tx('未能建立匿名身份。請再試一次。', 'Could not open an anonymous session. Try again.')
  if (code.includes('invalid_display_name')) return tx('名字請保持在三十二個字以內，且不要留空。', 'Use a name, up to 32 characters.')
  if (code.includes('invalid_email')) return tx('電郵看起來不完整。可以留空，或再檢查一次。', 'That email looks incomplete. Leave it blank, or check it.')
  if (code.includes('invalid_state')) return tx('這一刻還不能做這一步。已結束的房間不能再加入。', 'You cannot do that right now. An ended room cannot be joined.')
  if (code.includes('Failed to fetch') || code.includes('NetworkError') || code.includes('網絡')) {
    return tx('連不上房間。請稍後再試。', 'Could not reach the room. Try again in a moment.')
  }
  return tx('暫時未能完成。請再試一次。', 'That did not finish. Try again.')
}
