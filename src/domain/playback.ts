import type { RoomMusic } from './types.ts'

/** Time for every device to receive the command before sound starts. */
export const MUSIC_LEAD_MS = 1200

export function musicPositionMs(music: RoomMusic, nowMs: number, durationMs: number | null): number {
  const base = Math.max(0, music.positionMs)
  const unwrapped = music.playing ? base + Math.max(0, nowMs - music.anchorAt) : base
  if (durationMs != null && durationMs > 0) return unwrapped % durationMs
  return unwrapped
}

export function startMusic(trackId: string, positionMs: number, nowMs: number): RoomMusic {
  return {
    trackId,
    playing: true,
    positionMs: Math.max(0, positionMs),
    anchorAt: nowMs + MUSIC_LEAD_MS,
  }
}

export function pauseMusic(current: RoomMusic, nowMs: number): RoomMusic {
  return {
    trackId: current.trackId,
    playing: false,
    positionMs: musicPositionMs(current, nowMs, null),
    anchorAt: nowMs,
  }
}

export function selectMusic(trackId: string, nowMs: number): RoomMusic {
  return { trackId, playing: false, positionMs: 0, anchorAt: nowMs }
}

export type MusicAction = 'play' | 'pause' | 'select'

export function nextMusic(current: RoomMusic | null, action: MusicAction, trackId: string, nowMs: number): RoomMusic | null {
  if (action === 'select') return selectMusic(trackId, nowMs)
  if (action === 'pause') {
    if (!current?.playing) return current
    return pauseMusic(current, nowMs)
  }
  if (current?.trackId === trackId && current.playing) return current
  if (current?.trackId === trackId) return startMusic(trackId, current.positionMs, nowMs)
  return startMusic(trackId, 0, nowMs)
}

export interface ClockSample {
  offset: number
  rtt: number
}

/** NTP-style offset from the host clock. Lowest RTT sample wins. */
export function sampleClock(t0: number, t1: number, t2: number, t3: number): ClockSample | null {
  const rtt = t3 - t0 - (t2 - t1)
  if (!Number.isFinite(rtt) || rtt < 0 || rtt > 1500) return null
  const offset = ((t1 - t0) + (t2 - t3)) / 2
  if (!Number.isFinite(offset)) return null
  return { offset, rtt }
}

export function bestClockOffset(samples: ClockSample[]): number {
  if (samples.length === 0) return 0
  return samples.reduce((best, sample) => (sample.rtt < best.rtt ? sample : best)).offset
}
