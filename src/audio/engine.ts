import { musicPositionMs } from '@/domain/playback'
import { findTrack, musicSrc } from '@/domain/musicTracks'
import type { RoomMusic } from '@/domain/types'

let ctx: AudioContext | null = null
let gain: GainNode | null = null
let source: AudioBufferSourceNode | null = null
const buffers = new Map<string, Promise<AudioBuffer>>()
let playing: { trackId: string; anchorAt: number; contextStart: number; offsetMs: number } | null = null
let token = 0

function context() {
  if (!ctx || !gain) {
    ctx = new AudioContext()
    gain = ctx.createGain()
    gain.connect(ctx.destination)
  }
  return ctx
}

export function unlockRoomAudio() {
  const audio = context()
  void audio.resume()
  const silent = audio.createBuffer(1, 1, 22050)
  const node = audio.createBufferSource()
  node.buffer = silent
  node.connect(audio.destination)
  try {
    node.start()
  } catch {
    /* 已經播過一段靜音。 */
  }
}

export function roomAudioRunning() {
  return ctx?.state === 'running'
}

function loadBuffer(id: string, src: string) {
  const audio = context()
  const cached = buffers.get(id)
  if (cached) return cached
  const pending = fetch(src)
    .then((response) => {
      if (!response.ok) throw new Error('music')
      return response.arrayBuffer()
    })
    .then((bytes) => audio.decodeAudioData(bytes))
  buffers.set(id, pending)
  pending.catch(() => {
    buffers.delete(id)
  })
  return pending
}

function stopSource() {
  if (!source) {
    playing = null
    return
  }
  try {
    source.stop()
  } catch {
    /* 已經停了。 */
  }
  source.disconnect()
  source = null
  playing = null
}

function circularDelta(actual: number, target: number, duration: number) {
  let delta = actual - target
  if (duration > 0) {
    while (delta > duration / 2) delta -= duration
    while (delta < -duration / 2) delta += duration
  }
  return delta
}

export async function alignRoomAudio(
  music: RoomMusic | null,
  hostNowMs: number,
  volume: number,
): Promise<'idle' | 'locked' | 'playing' | 'paused'> {
  const mine = ++token
  if (!ctx || !gain) {
    return music?.playing ? 'locked' : 'idle'
  }
  gain.gain.value = Math.min(1, Math.max(0, volume))
  if (!music) {
    stopSource()
    return 'idle'
  }
  const track = findTrack(music.trackId)
  if (!track) {
    stopSource()
    return 'idle'
  }
  if (!music.playing) {
    stopSource()
    return 'paused'
  }
  if (ctx.state !== 'running') return 'locked'
  const buffer = await loadBuffer(track.id, musicSrc(track))
  if (mine !== token || !ctx || !gain) return 'idle'
  const durationMs = buffer.duration * 1000
  const target = musicPositionMs(music, hostNowMs, durationMs)
  if (playing && playing.trackId === music.trackId && playing.anchorAt === music.anchorAt) {
    const elapsed = Math.max(0, (ctx.currentTime - playing.contextStart) * 1000)
    const actual = (playing.offsetMs + elapsed) % durationMs
    if (Math.abs(circularDelta(actual, target, durationMs)) < 80) return 'playing'
  }
  stopSource()
  const node = ctx.createBufferSource()
  node.buffer = buffer
  node.loop = true
  node.connect(gain)
  const waiting = music.anchorAt > hostNowMs
  const offsetMs = waiting ? Math.max(0, music.positionMs) % durationMs : target
  const when = ctx.currentTime + (waiting ? (music.anchorAt - hostNowMs) / 1000 : 0)
  node.start(when, offsetMs / 1000)
  source = node
  playing = { trackId: music.trackId, anchorAt: music.anchorAt, contextStart: when, offsetMs }
  return 'playing'
}
