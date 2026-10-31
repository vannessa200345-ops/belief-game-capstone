import type { AttentionKind, Phase } from './types.ts'

export function formatSeconds(ms: number | null, lang: 'zh' | 'en' = 'zh'): string {
  if (ms == null || Number.isNaN(ms)) return '—'
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (lang === 'en') {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`
  }
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest === 0 ? `${minutes} 分` : `${minutes} 分 ${rest} 秒`
}

export function formatPercent(value: number | null): string {
  if (value == null) return '—'
  return `${Math.round(value * 100)}%`
}

export function phaseLabel(phase: Phase, lang: 'zh' | 'en' = 'zh'): string {
  const en = lang === 'en'
  switch (phase) {
    case 'lobby':
      return en ? 'Not started' : '尚未開始'
    case 'playing':
      return en ? 'Answering' : '作答中'
    case 'paused':
      return en ? 'Paused' : '暫停中'
    case 'revealed':
      return en ? 'Shown' : '已揭示'
    case 'final':
      return en ? 'Ended' : '已結束'
  }
}

export function attentionLabel(kind: AttentionKind, lang: 'zh' | 'en' = 'zh'): string {
  const en = lang === 'en'
  switch (kind) {
    case 'timeout':
      return en ? 'Still on this card' : '仲停喺呢張'
    case 'stuck':
      return en ? 'Paused here' : '停住'
    case 'offline':
      return en ? 'Not connected' : '未連上'
    case 'slow':
      return en ? 'Taking longer' : '用得較久'
  }
}

export function attentionNote(kind: AttentionKind, lang: 'zh' | 'en' = 'zh'): string {
  const en = lang === 'en'
  switch (kind) {
    case 'timeout':
      return en ? 'No choice yet on this card. Time is only a note, not a penalty.' : '呢張未有選擇。時間只係紀錄，唔會扣分。'
    case 'stuck':
      return en ? 'Still on this card' : '仍停在這一張'
    case 'offline':
      return en ? 'Not connected to this room' : '連線不在這一房'
    case 'slow':
      return en ? 'No choice yet. This only describes time spent.' : '還沒有留下選擇。呢度只描述用咗幾耐。'
  }
}
