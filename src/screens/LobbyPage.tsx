import { useState } from 'react'
import { api } from '@/api'
import { useGame } from '@/api/useGame'
import { BrandMark } from '@/components/BrandMark'
import { NextStep } from '@/components/NextStep'
import { SelfPaceNotice } from '@/components/SelfPaceNotice'
import { Frame } from '@/components/Frame'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { ROOM_CAPACITY, ROOM_IDEAL } from '@/domain/constants'
import { deckMeta } from '@/domain/cards'
import { youPlayer } from '@/domain/selectors'
import { useLang } from '@/i18n/lang'
import { usePageTitle } from '@/lib/title'

export function LobbyPage() {
  const state = useGame()
  const { lang, tx } = useLang()
  const you = youPlayer(state)
  const deck = deckMeta(state.room.deck)
  const [pending, setPending] = useState(false)
  usePageTitle(tx('信念遊戲 · 等候', 'Belief Game · Waiting'))

  async function leave() {
    setPending(true)
    await api.leaveRoom()
    setPending(false)
  }

  return (
    <Frame>
      <main id="main">
        <BrandMark />
        <p className="mt-12 text-sm text-muted">{tx('你已在房間裡', 'You are in the room')}</p>
        <h1 className="mt-2 text-[1.7rem] font-medium leading-snug">
          {tx('先坐下。主持開始後，你可以自己一張接一張看完。', 'Sit down. After the host starts, you move through the cards yourself.')}
        </h1>
        <div className="mt-4">
          <NextStep label={tx('下一步：', 'Next: ')}>
            {tx('等主持撳「開始自速」。你唔使做其他嘢。', 'wait for the host to press Start self-paced. You do not need to do anything else.')}
          </NextStep>
        </div>

        <Panel className="mt-8 px-6 py-6">
          <p className="text-sm text-muted">{tx('房間碼', 'Room code')}</p>
          <p className="mt-1 font-latin text-3xl tracking-[0.18em] text-ink sm:text-4xl">{state.room.code}</p>
          <div className="mt-5 h-px w-8 bg-gold" aria-hidden="true" />
          <p className="mt-5 text-base text-ink">{lang === 'en' ? deck.nameEn : deck.name}</p>
          <p className="mt-1 text-sm text-muted">{lang === 'en' ? deck.noteEn : deck.note}</p>
          <p className="mt-5 text-sm leading-relaxed text-muted">
            {tx(
              `在場 ${state.players.length} 人。理想約 ${ROOM_IDEAL} 人，上限 ${ROOM_CAPACITY} 人。`,
              `${state.players.length} people here. Ideal about ${ROOM_IDEAL}, maximum ${ROOM_CAPACITY}.`,
            )}
          </p>
          {you ? <p className="mt-3 text-sm text-ink">{tx(`這一場稱你為${you.name}。`, `This session calls you ${you.name}.`)}</p> : null}
        </Panel>

        <p className="mt-6 text-sm leading-relaxed text-muted">
          {tx('開始之後，每張只選是或毫無道理，選好就到下一張。', 'After it starts, choose Yes or No on each card. The next card follows.')}
        </p>
        <div className="mt-3">
          <SelfPaceNotice link={state.selfPaceLink} />
        </div>
        <Button className="mt-8" variant="ghost" onClick={() => void leave()} disabled={pending}>
          {tx('離開這一場', 'Leave this session')}
        </Button>
      </main>
    </Frame>
  )
}
