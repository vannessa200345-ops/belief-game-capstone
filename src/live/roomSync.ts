import type { RealtimeChannel } from '@supabase/supabase-js'
import { bestClockOffset, sampleClock, type ClockSample } from '../domain/playback.ts'
import type { RoomMusic } from '../domain/types.ts'
import { setClockOffset } from '../audio/clock.ts'
import { getSupabase } from '../lib/supabase.ts'

interface SyncHandlers {
  isHost: () => boolean
  hostId: () => string | null
  onMusic: (music: RoomMusic | null) => void
}

function isMusic(value: unknown): value is RoomMusic {
  if (!value || typeof value !== 'object') return false
  const music = value as RoomMusic
  return (
    typeof music.trackId === 'string' &&
    typeof music.playing === 'boolean' &&
    typeof music.positionMs === 'number' &&
    typeof music.anchorAt === 'number'
  )
}

export function bindRoomSync(roomId: string, handlers: SyncHandlers) {
  const supabase = getSupabase()
  let open = false
  let closed = false
  let pingId = ''
  const samples: ClockSample[] = []
  const channel: RealtimeChannel = supabase.channel(`room-sync:${roomId}`, {
    config: { broadcast: { self: false } },
  })

  const send = (event: string, payload: unknown) => {
    if (!open || closed) return
    void channel.send({ type: 'broadcast', event, payload })
  }

  const poke = () => {
    if (closed || handlers.isHost()) return
    pingId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    send('ping', { id: pingId, t0: Date.now() })
  }

  channel
    .on('broadcast', { event: 'ping' }, ({ payload }) => {
      if (!handlers.isHost()) return
      const body = payload as { id?: unknown; t0?: unknown }
      if (typeof body?.id !== 'string' || typeof body.t0 !== 'number') return
      const t1 = Date.now()
      send('pong', { id: body.id, t0: body.t0, t1, t2: Date.now() })
    })
    .on('broadcast', { event: 'pong' }, ({ payload }) => {
      if (handlers.isHost()) return
      const body = payload as { id?: unknown; t0?: unknown; t1?: unknown; t2?: unknown }
      if (body?.id !== pingId) return
      if (typeof body.t0 !== 'number' || typeof body.t1 !== 'number' || typeof body.t2 !== 'number') return
      const sample = sampleClock(body.t0, body.t1, body.t2, Date.now())
      if (!sample) return
      samples.push(sample)
      if (samples.length > 8) samples.shift()
      setClockOffset(bestClockOffset(samples))
    })
    .on('broadcast', { event: 'state' }, ({ payload }) => {
      if (handlers.isHost()) return
      const body = payload as { hostId?: unknown; music?: unknown }
      if (body?.hostId !== handlers.hostId()) return
      if (body.music === null || isMusic(body.music)) handlers.onMusic(body.music ?? null)
    })
    .subscribe((status) => {
      open = status === 'SUBSCRIBED'
      if (open) poke()
    })

  const timer = window.setInterval(poke, 3000)

  return {
    publish(music: RoomMusic | null) {
      const hostId = handlers.hostId()
      if (!hostId) return
      send('state', { hostId, music })
    },
    close() {
      closed = true
      window.clearInterval(timer)
      void supabase.removeChannel(channel)
    },
  }
}
