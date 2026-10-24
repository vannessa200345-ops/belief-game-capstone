import { useState } from 'react'
import { api } from '@/api'
import { useGame } from '@/api/useGame'
import { playerName, yourQueuePosition } from '@/domain/selectors'
import { Button } from './ui/button'

export function SpeakControl() {
  const state = useGame()
  const [pending, setPending] = useState(false)
  const position = yourQueuePosition(state)
  const calledYou = state.called != null && state.called.playerId === state.youId
  const calledName = state.called ? playerName(state, state.called.playerId) : null
  const open = state.room.phase === 'playing' || state.room.phase === 'paused' || state.room.phase === 'revealed'

  async function request() {
    setPending(true)
    await api.requestSpeak()
    setPending(false)
  }

  async function lower() {
    setPending(true)
    await api.lowerHand()
    setPending(false)
  }

  if (!open) return null

  return (
    <div className="rounded-[24px] border border-line bg-white/80 px-4 py-4">
      {calledYou ? (
        <p className="text-sm leading-relaxed text-ink">
          主持請你發言。請在 Zoom 或 Meet 自行打開麥克風，這裡不會替你解除靜音。
        </p>
      ) : calledName ? (
        <p className="text-sm text-muted">現在請 {calledName} 發言。</p>
      ) : (
        <p className="text-sm text-muted">如果想說一句，可以先排隊。順序由主持來叫。</p>
      )}
      <div className="mt-3">
        {position != null ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink">已排隊，你是第 {position} 位。</p>
            <Button variant="ghost" onClick={() => void lower()} disabled={pending}>
              放下手
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => void request()} disabled={pending}>
            {calledYou ? '想再發言' : '想發言'}
          </Button>
        )}
      </div>
    </div>
  )
}
