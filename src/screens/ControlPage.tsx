import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import { useGame } from '@/api/useGame'
import { BrandMark } from '@/components/BrandMark'
import { SelfPaceNotice } from '@/components/SelfPaceNotice'
import { Frame } from '@/components/Frame'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { phaseLabel } from '@/domain/format'
import { playerName, selectPaceBoard } from '@/domain/selectors'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/lib/title'

export function ControlPage() {
  const state = useGame()
  const board = selectPaceBoard(state)
  const [pending, setPending] = useState<'start' | 'end' | 'call' | 'pause' | 'clear' | null>(null)
  usePageTitle(`信念遊戲 · 主持 ${state.room.code}`)

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

  return (
    <Frame width="host">
      <main id="main">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <BrandMark kicker="Host" />
          <div className="flex items-center gap-4 text-sm">
            <Link to="/host" className="text-muted underline decoration-line underline-offset-4 hover:text-ink">
              開場
            </Link>
            <Link
              to="/host/analytics"
              className="text-muted underline decoration-line underline-offset-4 hover:text-ink"
            >
              這一場的整理
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">房間碼</p>
            <p className="font-latin text-3xl tracking-[0.16em] text-ink sm:text-4xl">{state.room.code}</p>
          </div>
          <p className="text-sm text-muted">
            {phaseLabel(state.room.phase)}
            {state.room.phase === 'playing' || state.room.phase === 'paused'
              ? ` · ${board.total} 句自速`
              : null}
          </p>
        </div>

        <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            {state.room.phase === 'lobby' ? (
              <Panel className="px-6 py-6">
                <h1 className="text-xl font-medium">這一場還沒開始</h1>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  在場 {state.players.length} 人。按一次開始，學員就會自己逐張選是或否。
                </p>
                <Button className="mt-5" onClick={() => void start()} disabled={pending != null}>
                  {pending === 'start' ? '正在開始' : '開始自速'}
                </Button>
              </Panel>
            ) : null}

            {state.room.phase === 'final' ? (
              <Panel className="px-6 py-6">
                <h1 className="text-xl font-medium">這一場已結束</h1>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  學員會看到自己的整理。分數不會出現在他們的主畫面。
                </p>
                <Button asChild className="mt-5" variant="outline">
                  <Link to="/host/analytics">查看錯得較多的卡</Link>
                </Button>
              </Panel>
            ) : null}

            {state.room.phase === 'playing' || state.room.phase === 'paused' ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <CountTile label="學員" value={board.learners} bar="bg-sky" />
                  <CountTile label="已看完" value={board.finished} bar="bg-mint" />
                  <CountTile label="已收答" value={state.serverAnswerCount} bar="bg-lavender" />
                </div>
                <Panel className="px-5 py-4" aria-live="polite">
                  <h2 className="text-base font-medium">進度</h2>
                  <p className="mt-1 text-sm text-muted">每人自己看完 {board.total} 句。這裡不逐張揭示。</p>
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
                          {row.name}
                          {row.host ? <span className="text-muted"> · 主持</span> : null}
                        </span>
                        <span className="text-sm text-muted">
                          {row.host
                            ? '不計入'
                            : !row.connected
                              ? '未連上'
                              : row.done
                                ? '已看完'
                                : row.stuck
                                  ? `停住 · ${row.answered}/${board.total}`
                                  : `${row.answered}/${board.total}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3">
                    <SelfPaceNotice link={state.selfPaceLink} />
                  </div>
                  {state.selfPaceLink === 'live' && waitingOnServer ? (
                    <p className="mt-3 text-sm leading-relaxed text-muted">已接上自速。選擇會陸續回到這裡。</p>
                  ) : null}
                </Panel>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" className="flex-1" disabled={pending != null} onClick={() => void end()}>
                    {pending === 'end' ? '正在結束' : '結束這一場'}
                  </Button>
                  {state.room.phase === 'playing' ? (
                    <Button variant="ghost" disabled={pending != null} onClick={() => void pause()}>
                      {pending === 'pause' ? '正在暫停' : '暫停'}
                    </Button>
                  ) : (
                    <Button variant="ghost" disabled={pending != null} onClick={() => void resume()}>
                      {pending === 'start' ? '正在繼續' : '繼續'}
                    </Button>
                  )}
                </div>
              </>
            ) : null}

            <details className="rounded-[24px] border border-line bg-white/80 px-5 py-4">
              <summary className="cursor-pointer text-sm text-ink">在場名單（{state.players.length}）· 預設收起</summary>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted sm:grid-cols-3">
                {state.players.map((player) => (
                  <li key={player.id}>
                    {player.name}
                    {!player.connected ? ' · 未連上' : ''}
                    {!player.demo ? ' · 學員' : ''}
                  </li>
                ))}
              </ul>
            </details>
          </div>

          <aside className="lg:sticky lg:top-6">
            <Panel className="px-5 py-5">
              <h2 className="text-base font-medium">發言隊列</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                這裡只排順序，不會自動取消 Zoom 靜音。
              </p>
              {state.queue.length === 0 ? (
                <p className="mt-4 text-sm text-ink">暫時沒有人想發言。</p>
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
                下一位
              </Button>
              <Button
                className="mt-2 w-full"
                variant="ghost"
                disabled={state.queue.length === 0 || pending != null}
                onClick={() => void clearQueue()}
              >
                {pending === 'clear' ? '正在清空' : '清空隊列'}
              </Button>
              {calledName ? (
                <p className="mt-3 text-sm leading-relaxed text-ink" role="status">
                  請 {calledName} 發言。麥克風要在 Zoom 或 Meet 那邊自己打開。
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
      <div className={cn('h-1', bar)} aria-hidden="true" />
      <div className="px-3 py-3 sm:px-4">
        <p className="text-2xl font-medium tracking-tight text-ink sm:text-3xl">{value}</p>
        <p className="mt-1 text-sm text-muted">{label}</p>
      </div>
    </div>
  )
}
