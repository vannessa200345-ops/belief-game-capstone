import { useState } from 'react'
import { api } from '@/api'
import { useGame } from '@/api/useGame'
import { playerName, yourQueuePosition } from '@/domain/selectors'
import { useLang } from '@/i18n/lang'
import { Button } from './ui/button'

export function SpeakControl() {
  const state = useGame()
  const { tx } = useLang()
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
          {tx('主持請你發言。請在 Zoom 或 Meet 自行打開麥克風，這裡不會替你解除靜音。', 'The host invited you to speak. Unmute yourself on Zoom or Meet. This room will not unmute you.')}
        </p>
      ) : calledName ? (
        <p className="text-sm text-muted">{tx(`現在請 ${calledName} 發言。`, `${calledName} is invited to speak.`)}</p>
      ) : (
        <p className="text-sm text-muted">{tx('如果想用咪講，可以先排隊。想打字就用上面個文字框。', 'Queue here only if you want the mic. For text, use the message box above.')}</p>
      )}
      <div className="mt-3">
        {position != null ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink">{tx(`已排隊，你是第 ${position} 位。`, `You are queued, place ${position}.`)}</p>
            <Button variant="ghost" onClick={() => void lower()} disabled={pending}>
              {tx('放下手', 'Lower hand')}
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => void request()} disabled={pending}>
            {calledYou ? tx('想再發言', 'Speak again') : tx('想發言', 'I want to speak')}
          </Button>
        )}
      </div>
    </div>
  )
}
