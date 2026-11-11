import { useEffect, useRef, useState } from 'react'
import { useGame } from '@/api/useGame'
import { hostNow, isClockReady } from '@/audio/clock'
import { alignRoomAudio, roomAudioRunning, unlockRoomAudio } from '@/audio/engine'
import { findTrack } from '@/domain/musicTracks'
import { useLang } from '@/i18n/lang'

const VOLUME_KEY = 'belief-music-volume'

function readVolume() {
  try {
    const raw = localStorage.getItem(VOLUME_KEY)
    const value = raw == null ? 0.6 : Number(raw)
    if (!Number.isFinite(value)) return 0.6
    return Math.min(1, Math.max(0, value))
  } catch {
    return 0.6
  }
}

export function RoomAudio() {
  const state = useGame()
  const { tx } = useLang()
  const [volume, setVolume] = useState(readVolume)
  const [locked, setLocked] = useState(false)
  const [clockReady, setClockReady] = useState(false)
  const musicRef = useRef(state.music)
  const volumeRef = useRef(volume)
  const hostRef = useRef(false)
  const you = state.players.find((player) => player.id === state.youId)
  const markedHost = state.players.some((player) => player.host)
  const isHost = Boolean(you?.host) || !markedHost
  musicRef.current = state.music
  volumeRef.current = volume
  hostRef.current = isHost
  const track = findTrack(state.music?.trackId)

  useEffect(() => {
    const onPointer = () => unlockRoomAudio()
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [])

  useEffect(() => {
    let cancel = false
    const run = () => {
      const music = musicRef.current
      const ready = hostRef.current || isClockReady()
      setClockReady(ready)
      if (music?.playing && !ready) {
        setLocked(false)
        return
      }
      const now = hostRef.current ? Date.now() : hostNow()
      void alignRoomAudio(music, now, volumeRef.current).then((status) => {
        if (!cancel) setLocked(status === 'locked' || (Boolean(music?.playing) && !roomAudioRunning()))
      })
    }
    run()
    const timer = window.setInterval(run, 1000)
    return () => {
      cancel = true
      window.clearInterval(timer)
    }
  }, [state.music, volume, isHost])

  useEffect(() => {
    document.body.style.paddingBottom = state.music ? '6.5rem' : ''
    return () => {
      document.body.style.paddingBottom = ''
    }
  }, [state.music])

  if (!state.music || !track) return null

  const waiting = Boolean(state.music.playing && !isHost && !clockReady)

  function changeVolume(next: number) {
    const value = Math.min(1, Math.max(0, next))
    setVolume(value)
    try {
      localStorage.setItem(VOLUME_KEY, String(value))
    } catch {
      /* 音量只留在這部裝置。 */
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2">
        <p className="min-w-0 text-sm text-ink">
          <span className="text-muted">{tx('背景音樂', 'Background music')}</span>
          <span className="mt-0.5 block truncate">
            {track.title} · {track.artist} · {track.license}
          </span>
        </p>
        {locked ? (
          <button
            type="button"
            className="rounded-full bg-pink px-4 py-2 text-sm text-ink"
            onClick={() => {
              unlockRoomAudio()
              setLocked(false)
            }}
          >
            {tx('請按一下以開啟聲音', 'Tap once to turn sound on')}
          </button>
        ) : null}
        {waiting ? <p className="text-sm text-muted">{tx('正在對齊播放時間。', 'Lining up the playback time.')}</p> : null}
        <label className="flex min-w-40 flex-1 items-center gap-3 text-sm text-ink">
          <span className="shrink-0">{volume === 0 ? tx('已靜音', 'Muted') : tx('音量', 'Volume')}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            aria-label={tx('本機音量', 'Volume on this device')}
            onChange={(event) => changeVolume(Number(event.target.value) / 100)}
          />
        </label>
      </div>
    </div>
  )
}
