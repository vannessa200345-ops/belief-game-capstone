import { useState } from 'react'
import { api } from '@/api'
import { useGame } from '@/api/useGame'
import { findTrack, MUSIC_TRACKS } from '@/domain/musicTracks'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { useLang } from '@/i18n/lang'

export function HostMusic() {
  const state = useGame()
  const { tx } = useLang()
  const [draftId, setDraftId] = useState(MUSIC_TRACKS[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const you = state.players.find((player) => player.id === state.youId)
  const markedHost = state.players.some((player) => player.host)
  if (markedHost && !you?.host) return null

  const selected = state.music?.trackId ?? draftId
  const track = findTrack(selected) ?? MUSIC_TRACKS[0]
  const playing = Boolean(state.music?.playing && state.music.trackId === selected)

  async function choose(id: string) {
    setDraftId(id)
    setError(null)
    const result = await api.setRoomMusic({
      trackId: id,
      action: state.music?.playing ? 'play' : 'select',
    })
    if (!result.ok) setError(result.error)
  }

  async function play() {
    if (!track) return
    setError(null)
    const result = await api.setRoomMusic({ trackId: track.id, action: 'play' })
    if (!result.ok) setError(result.error)
  }

  async function pause() {
    if (!track) return
    setError(null)
    const result = await api.setRoomMusic({ trackId: track.id, action: 'pause' })
    if (!result.ok) setError(result.error)
  }

  return (
    <Panel className="px-5 py-5">
      <h2 className="text-base font-medium">{tx('背景音樂', 'Background music')}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {tx(
          '由主持選擇曲目與播放。全場會同時開始、暫停及換曲。各裝置可自行調節音量。',
          'The host chooses the track and playback. The whole room starts, pauses, and changes tracks together. Each device can set its own volume.',
        )}
      </p>
      <label className="mt-4 block text-sm text-ink" htmlFor="host-music-track">
        {tx('曲目', 'Track')}
      </label>
      <select
        id="host-music-track"
        className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-lavender"
        value={track?.id ?? ''}
        onChange={(event) => void choose(event.target.value)}
      >
        {MUSIC_TRACKS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
      <div className="mt-3 flex gap-3">
        <Button type="button" onClick={() => void play()} disabled={!track || playing}>
          {tx('播放', 'Play')}
        </Button>
        <Button type="button" variant="outline" onClick={() => void pause()} disabled={!state.music?.playing}>
          {tx('暫停', 'Pause')}
        </Button>
      </div>
      {track ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {tx(
            `${track.title}，${track.artist}。授權：${track.license}。`,
            `${track.title}, ${track.artist}. License: ${track.license}.`,
          )}{' '}
          <a className="underline decoration-line underline-offset-4" href={track.licenseUrl} target="_blank" rel="noreferrer">
            {track.license}
          </a>
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-ink" role="alert">
          {error}
        </p>
      ) : null}
    </Panel>
  )
}
