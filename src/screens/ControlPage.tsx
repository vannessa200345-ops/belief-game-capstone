import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import { useGame } from '@/api/useGame'
import { BrandMark } from '@/components/BrandMark'
import { CardWave } from '@/components/CardWave'
import { HostMessage } from '@/components/HostMessage'
import { Leaderboard } from '@/components/Leaderboard'
import { NextStep } from '@/components/NextStep'
import { SelfPaceNotice } from '@/components/SelfPaceNotice'
import { Frame } from '@/components/Frame'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { phaseLabel } from '@/domain/format'
import { playerName, selectPaceBoard } from '@/domain/selectors'
import { useLang } from '@/i18n/lang'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/lib/title'

export function ControlPage() {
  const state = useGame()
  const { lang, tx } = useLang()
  const board = selectPaceBoard(state)
  const [pending, setPending] = useState<'start' | 'end' | 'call' | 'pause' | 'clear' | null>(null)
  usePageTitle(tx(`信念遊戲 · 主持 ${state.room.code}`, `Belief Game · Host ${state.room.code}`))

  async function start() {
    setPending('start')
    await api.startRoom()
    setPending(null)
  }

  async function callNext() {
    setPending('call')
    await api.advanceSpeaker()
    setPending(null)
  }

  async function end() {
    setPending('end')
    await api.endRoom()
    setPending(null)
  }

  async function pause() {
    setPending('pause')
    await api.pauseRoom()
    setPending(null)
  }

  async function resume() {
    setPending('start')
    await api.startRoom()
    setPending(null)
  }

  async function clearQueue() {
    setPending('clear')
    await api.clearSpeakQueue()
    setPending(null)
  }

  const calledName = state.called ? playerName(state, state.called.playerId) : null
  const waitingOnServer = state.room.phase === 'playing' && state.serverAnswerCount === 0 && board.finished === 0
  const learners = board.rows.filter((row) => !row.host)

  return (
    <Frame width="host">
      <main id="main">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <BrandMark kicker="Host" />
          <div className="flex items-center gap-4 text-sm">
            <Link to="/host" className="text-muted underline decoration-line underline-offset-4 hover:text-ink">
              {tx('開場', 'Lobby')}
            </Link>
            <Link to="/host/analytics" className="text-muted underline decoration-line underline-offset-4 hover:text-ink">
              {tx('這一場的整理', 'This session')}
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{tx('房間碼', 'Room code')}</p>
            <p className="font-latin text-3xl tracking-[0.16em] text-ink sm:text-4xl">{state.room.code}</p>
          </div>
          <p className="text-sm text-muted">
            {phaseLabel(state.room.phase, lang)}
            {state.room.phase === 'playing' || state.room.phase === 'paused'
              ? tx(` · ${board.total} 句答題`, ` · ${board.total} cards to answer`)
              : null}
          </p>
        </div>
        <div className="mt-4">
          <NextStep label={tx('下一步：', 'Next: ')}>
            {state.room.phase === 'lobby'
              ? tx('等人到齊，撳「開始答題」。卡序會喺呢一場打亂。', 'when people are in, press Start answering. Card order is shuffled for this room.')
              : state.room.phase === 'final'
                ? tx('撳學員個名，打開佢嘅整理做複盤。', 'open a learner’s name to see their summary for the debrief.')
                : tx('睇條形。撳一條柱就見到係邊張卡。學員可以傳字過嚟。', 'watch the bars. Click one to see the card. Learners can text you.')}
          </NextStep>
        </div>

        {state.room.phase !== 'lobby' ? (
          <div className="mt-6">
            <CardWave />
          </div>
        ) : null}

        <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            {state.room.phase === 'lobby' ? (
              <Panel className="px-6 py-6">
                <h1 className="text-xl font-medium">{tx('這一場還沒開始', 'This session has not started')}</h1>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {tx(
                    `在場 ${state.players.length} 人。按一次開始，學員就會自己逐張選是或毫無道理。`,
                    `${state.players.length} people are here. Press start once. Learners then choose Yes or No on their own.`,
                  )}
                </p>
                <Button className="mt-5" onClick={() => void start()} disabled={pending != null}>
                  {pending === 'start' ? tx('正在開始', 'Starting') : tx('開始答題', 'Start answering')}
                </Button>
              </Panel>
            ) : null}

            {state.room.phase === 'final' ? (
              <Panel className="px-6 py-6">
                <h1 className="text-xl font-medium">{tx('這一場已結束', 'This session has ended')}</h1>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {tx('學員會看到自己的整理，以及這一場的排名。你可以打開每一個人的整理。', 'Learners see their own summary and this session’s rank. You can open each person’s summary.')}
                </p>
                <Button asChild className="mt-5" variant="outline">
                  <Link to="/host/analytics">{tx('查看與參考方向不同較多的卡', 'See cards that differed most')}</Link>
                </Button>
              </Panel>
            ) : null}

            {state.room.phase === 'final' ? <Leaderboard /> : null}

            {state.room.phase === 'playing' || state.room.phase === 'paused' || state.room.phase === 'final' ? (
              <Panel className="px-5 py-4">
                <h2 className="text-base font-medium">{tx('學員整理', 'Learner summaries')}</h2>
                <p className="mt-1 text-sm text-muted">
                  {tx('打開就係佢呢一場嘅結果，只用呢場嘅選擇同用時。', 'Opens that person’s result for this session only.')}
                </p>
                <ul className="mt-3 space-y-2">
                  {learners.map((row) => (
                    <li key={row.playerId}>
                      <Link
                        to={`/host/debrief/${row.playerId}`}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-[#f7fbfe] px-4 py-2.5 text-sm text-ink underline-offset-4 hover:underline"
                      >
                        <span>{row.name}</span>
                        <span className="text-muted">{tx('打開整理', 'Open summary')}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}

            {state.room.phase === 'playing' || state.room.phase === 'paused' ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <CountTile label={tx('學員', 'Learners')} value={board.learners} bar="bg-sky" />
                  <CountTile label={tx('已看完', 'Finished')} value={board.finished} bar="bg-mint" />
                  <CountTile label={tx('已收答', 'Answers in')} value={state.serverAnswerCount} bar="bg-lavender" />
                </div>
                <Panel className="px-5 py-4" aria-live="polite">
                  <h2 className="text-base font-medium">{tx('進度', 'Progress')}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {tx(`每人自己看完 ${board.total} 句。這裡不逐張揭示。`, `Each person moves through ${board.total} lines. Nothing is revealed card by card.`)}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {board.rows.map((row) => (
                      <li
                        key={row.playerId}
                        className={cn(
                          'flex items-center justify-between gap-3 rounded-2xl px-4 py-2.5',
                          row.stuck ? 'bg-blush' : 'bg-[#f7fbfe]',
                        )}
                      >
                        <span className="text-sm text-ink">
                          {row.host ? (
                            row.name
                          ) : (
                            <Link to={`/host/debrief/${row.playerId}`} className="underline decoration-line underline-offset-4">
                              {row.name}
                            </Link>
                          )}
                          {row.host ? <span className="text-muted"> · {tx('主持', 'host')}</span> : null}
                        </span>
                        <span className="text-sm text-muted">
                          {row.host
                            ? tx('不計入', 'not scored')
                            : !row.connected
                              ? tx('未連上', 'not connected')
                              : row.done
                                ? tx('已看完', 'finished')
                                : row.stuck
                                  ? tx(`停住 · ${row.answered}/${board.total}`, `paused · ${row.answered}/${board.total}`)
                                  : `${row.answered}/${board.total}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3">
                    <SelfPaceNotice link={state.selfPaceLink} />
                  </div>
                  {state.selfPaceLink === 'live' && waitingOnServer ? (
                    <p className="mt-3 text-sm leading-relaxed text-muted">
                      {tx('已經可以答題。選擇會陸續回到這裡。', 'Answering is connected. Choices will show up here.')}
                    </p>
                  ) : null}
                </Panel>
                <Leaderboard />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" className="flex-1" disabled={pending != null} onClick={() => void end()}>
                    {pending === 'end' ? tx('正在結束', 'Ending') : tx('結束這一場', 'End this session')}
                  </Button>
                  {state.room.phase === 'playing' ? (
                    <Button variant="ghost" disabled={pending != null} onClick={() => void pause()}>
                      {pending === 'pause' ? tx('正在暫停', 'Pausing') : tx('暫停', 'Pause')}
                    </Button>
                  ) : (
                    <Button variant="ghost" disabled={pending != null} onClick={() => void resume()}>
                      {pending === 'start' ? tx('正在繼續', 'Resuming') : tx('繼續', 'Resume')}
                    </Button>
                  )}
                </div>
              </>
            ) : null}

            <HostMessage audience="host" />

            <details className="rounded-[24px] border border-line bg-white/80 px-5 py-4">
              <summary className="cursor-pointer text-sm text-ink">
                {tx(`在場名單（${state.players.length}）· 預設收起`, `People here (${state.players.length}) · collapsed`)}
              </summary>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted sm:grid-cols-3">
                {state.players.map((player) => (
                  <li key={player.id}>
                    {player.name}
                    {!player.connected ? tx(' · 未連上', ' · not connected') : ''}
                    {!player.demo ? tx(' · 學員', ' · learner') : ''}
                  </li>
                ))}
              </ul>
            </details>
          </div>

          <aside className="lg:sticky lg:top-6">
            <Panel className="px-5 py-5">
              <h2 className="text-base font-medium">{tx('發言隊列', 'Speaking queue')}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {tx('這裡只排順序，不會自動取消 Zoom 靜音。傳字唔使排隊。', 'This only sets speaking order. It does not unmute Zoom. Text does not need the queue.')}
              </p>
              {state.queue.length === 0 ? (
                <p className="mt-4 text-sm text-ink">{tx('暫時沒有人想發言。', 'Nobody is waiting to speak.')}</p>
              ) : (
                <ol className="mt-4 space-y-2">
                  {state.queue.map((item, index) => (
                    <li key={item.id} className="flex items-center gap-3 rounded-2xl bg-[#f7fbfe] px-3 py-2.5">
                      <span className="font-latin text-sm text-muted">{index + 1}</span>
                      <span className="text-sm text-ink">{playerName(state, item.playerId)}</span>
                    </li>
                  ))}
                </ol>
              )}
              <Button
                className="mt-4 w-full"
                variant="outline"
                disabled={state.queue.length === 0 || pending != null}
                onClick={() => void callNext()}
              >
                {tx('下一位', 'Next person')}
              </Button>
              <Button
                className="mt-2 w-full"
                variant="ghost"
                disabled={state.queue.length === 0 || pending != null}
                onClick={() => void clearQueue()}
              >
                {pending === 'clear' ? tx('正在清空', 'Clearing') : tx('清空隊列', 'Clear the queue')}
              </Button>
              {calledName ? (
                <p className="mt-3 text-sm leading-relaxed text-ink" role="status">
                  {tx(
                    `請 ${calledName} 發言。麥克風要在 Zoom 或 Meet 那邊自己打開。`,
                    `Invite ${calledName} to speak. They unmute themselves on Zoom or Meet.`,
                  )}
                </p>
              ) : null}
            </Panel>
          </aside>
        </div>
      </main>
    </Frame>
  )
}

function CountTile({ label, value, bar }: { label: string; value: number; bar: string }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-white">
      <div className={cn('h-1.5', bar)} />
      <div className="px-4 py-3">
        <p className="text-2xl text-ink">{value}</p>
        <p className="text-sm text-muted">{label}</p>
      </div>
    </div>
  )
}
