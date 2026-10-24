import { useState } from 'react'
import { api } from '@/api'
import { useGame } from '@/api/useGame'
import { BrandMark } from '@/components/BrandMark'
import { SelfPaceNotice } from '@/components/SelfPaceNotice'
import { Frame } from '@/components/Frame'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { ROOM_CAPACITY, ROOM_IDEAL } from '@/domain/constants'
import { deckMeta } from '@/domain/cards'
import { youPlayer } from '@/domain/selectors'
import { usePageTitle } from '@/lib/title'

export function LobbyPage() {
  const state = useGame()
  const you = youPlayer(state)
  const deck = deckMeta(state.room.deck)
  const [pending, setPending] = useState(false)
  usePageTitle('信念遊戲 · 等候')

  async function leave() {
    setPending(true)
    await api.leaveRoom()
    setPending(false)
  }

  return (
    <Frame>
      <main id="main">
        <BrandMark />
        <p className="mt-12 text-sm text-muted">你已在房間裡</p>
        <h1 className="mt-2 text-[1.7rem] font-medium leading-snug">先坐下。主持開始後，你可以自己一張接一張看完。</h1>

        <Panel className="mt-8 px-6 py-6">
          <p className="text-sm text-muted">房間碼</p>
          <p className="mt-1 font-latin text-3xl tracking-[0.18em] text-ink sm:text-4xl">{state.room.code}</p>
          <div className="mt-5 h-px w-8 bg-gold" aria-hidden="true" />
          <p className="mt-5 text-base text-ink">{deck.name}</p>
          <p className="mt-1 text-sm text-muted">{deck.note}</p>
          <p className="mt-5 text-sm leading-relaxed text-muted">
            在場 {state.players.length} 人。理想約 {ROOM_IDEAL} 人，上限 {ROOM_CAPACITY} 人。
          </p>
          {you ? <p className="mt-3 text-sm text-ink">這一場稱你為{you.name}。</p> : null}
        </Panel>

        <p className="mt-6 text-sm leading-relaxed text-muted">
          開始之後，每句只選是或否，選好就到下一張。不用等主持揭示。
        </p>
        <div className="mt-3">
          <SelfPaceNotice link={state.selfPaceLink} />
        </div>
        <Button className="mt-8" variant="ghost" onClick={() => void leave()} disabled={pending}>
          離開這一場
        </Button>
      </main>
    </Frame>
  )
}
