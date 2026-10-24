import type { NoticeEmailResult } from './types.ts'

/** 空白當成功並當成沒有留下。有字先檢查形狀。 */
export function parseNoticeEmail(value: string): NoticeEmailResult {
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, email: null }
  if (trimmed.length > 80) {
    return { ok: false, error: '電郵請保持在八十個字以內。可以改一改，或先留空。' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, error: '這個電郵看起來不完整。可以改一改，或先留空。' }
  }
  return { ok: true, email: trimmed }
}
