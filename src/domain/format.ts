import type { AttentionKind, Phase } from './types.ts'

export function formatSeconds(ms: number | null): string {
  if (ms == null || Number.isNaN(ms)) return '—'
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest === 0 ? `${minutes} 分` : `${minutes} 分 ${rest} 秒`
}

export function formatPercent(value: number | null): string {
  if (value == null) return '—'
  return `${Math.round(value * 100)}%`
}

export function phaseLabel(phase: Phase): string {
  switch (phase) {
    case 'lobby':
      return '尚未開始'
    case 'playing':
      return '作答中'
    case 'paused':
      return '暫停中'
    case 'revealed':
      return '已揭示'
    case 'final':
      return '已結束'
  }
}

export function attentionLabel(kind: AttentionKind): string {
  switch (kind) {
    case 'timeout':
      return '逾時'
    case 'stuck':
      return '停住'
    case 'offline':
      return '未連上'
    case 'slow':
      return '停得較久'
  }
}

export function attentionNote(kind: AttentionKind): string {
  switch (kind) {
    case 'timeout':
      return '這一輪未及作答'
    case 'stuck':
      return '仍停在這一張'
    case 'offline':
      return '連線不在這一房'
    case 'slow':
      return '還沒有留下選擇'
  }
}
