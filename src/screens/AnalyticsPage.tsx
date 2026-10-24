import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGame } from '@/api/useGame'
import { BrandMark } from '@/components/BrandMark'
import { Frame } from '@/components/Frame'
import { Panel } from '@/components/Panel'
import { Switch } from '@/components/ui/switch'
import { formatPercent, formatSeconds } from '@/domain/format'
import { selectAnalytics } from '@/domain/selectors'
import { usePageTitle } from '@/lib/title'

export function AnalyticsPage() {
  const state = useGame()
  const analytics = selectAnalytics(state)
  const [showScores, setShowScores] = useState(false)
  usePageTitle('信念遊戲 · 這一場的整理')

  return (
    <Frame width="host">
      <main id="main">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <BrandMark kicker="Host" />
          <Link
            to="/host/control"
            className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
          >
            返回主持台
          </Link>
        </div>

        <h1 className="mt-10 text-[1.85rem] font-medium leading-snug">這一場的整理</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
          先看錯得較多的卡，以及誰逾時、誰還沒選。分數預設不顯示，這裡也不是學員看得到的排行榜。
        </p>

        <Panel className="mt-8 px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-base font-medium" id="score-label">
                顯示分數
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                預設關閉。打開後只在這一頁，不會出現在學員畫面，也不會因此改排序。
              </p>
            </div>
            <Switch
              checked={showScores}
              onCheckedChange={setShowScores}
              disabled={analytics.cards.length === 0}
              aria-labelledby="score-label"
            />
          </div>
        </Panel>

        <section className="mt-8">
          <h2 className="text-lg font-medium">錯得比較多的卡</h2>
          <p className="mt-1 text-sm text-muted">按「與參考方向不同」加上逾時來排，不是獎台。伺服器未記低選擇時，這裡是空的。</p>
          {analytics.cards.length === 0 ? (
            <Panel className="mt-4 px-6 py-8">
              <p className="text-base text-ink">這一場還沒有伺服器上的作答紀錄。</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                學員自己看完這一套。對照回到伺服器之後，錯得較多的會排在上面。
              </p>
            </Panel>
          ) : (
            <ul className="mt-4 space-y-3">
              {analytics.cards.map((card) => (
                <li key={card.cardId}>
                  <Panel className="px-5 py-5">
                    <p className="text-sm text-muted">{card.theme}</p>
                    <p className="mt-2 text-base leading-relaxed text-ink">{card.text}</p>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-blush">
                      <div
                        className="h-full rounded-full bg-mint"
                        style={{ width: `${Math.round((card.accuracy ?? 0) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted">
                      準確率 {formatPercent(card.accuracy)} · 不同 {card.wrong} · 逾時 {card.timeout} · 未選{' '}
                      {card.missed}
                      {card.avgMs != null ? ` · 平均 ${formatSeconds(card.avgMs)}` : ''}
                    </p>
                  </Panel>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-medium">人與時間</h2>
          <p className="mt-1 text-sm text-muted">逾時的人在前面，其後按未選次數，不按分數。</p>
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[28px] border border-line bg-white">
            {analytics.players.map((player) => (
              <li key={player.playerId} className="px-5 py-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-ink">
                    {player.name}
                    {!player.connected ? <span className="text-muted"> · 未連上</span> : null}
                    {player.demo ? <span className="text-muted"> · 示範</span> : null}
                  </p>
                  <p className="text-sm text-muted">
                    {player.timeoutCount > 0 ? `逾時 ${player.timeoutCount}` : '沒有逾時'}
                  </p>
                </div>
                <p className="mt-1 text-sm text-muted">
                  平均 {formatSeconds(player.avgMs)} · 未選 {player.missedCount}
                  {showScores
                    ? ` · 與參考方向一致 ${player.correctCount}／${player.revealedCount}`
                    : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </Frame>
  )
}
