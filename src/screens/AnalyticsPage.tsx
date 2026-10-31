import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGame } from '@/api/useGame'
import { BrandMark } from '@/components/BrandMark'
import { Frame } from '@/components/Frame'
import { Panel } from '@/components/Panel'
import { Switch } from '@/components/ui/switch'
import { cardLine, findCard } from '@/domain/cards'
import { formatPercent, formatSeconds } from '@/domain/format'
import { beliefGroup, groupLabel } from '@/domain/report'
import { selectAnalytics } from '@/domain/selectors'
import { useLang } from '@/i18n/lang'
import { usePageTitle } from '@/lib/title'

export function AnalyticsPage() {
  const state = useGame()
  const { lang, tx } = useLang()
  const analytics = selectAnalytics(state)
  const [showScores, setShowScores] = useState(false)
  usePageTitle(tx('信念遊戲 · 這一場的整理', 'Belief Game · This session'))

  const groupTime = new Map<string, number[]>()
  for (const answer of state.answers) {
    const card = findCard(answer.cardId)
    if (!card) continue
    const label = groupLabel(beliefGroup(card.text), lang)
    const bucket = groupTime.get(label) ?? []
    bucket.push(answer.ms)
    groupTime.set(label, bucket)
  }

  return (
    <Frame width="host">
      <main id="main">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <BrandMark kicker="Host" />
          <Link to="/host/control" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
            {tx('返回主持台', 'Back to the console')}
          </Link>
        </div>

        <h1 className="mt-10 text-[1.85rem] font-medium leading-snug">{tx('這一場的整理', 'This session')}</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
          {tx(
            '先看與參考方向不同較多的卡，以及誰還沒選、平均用了幾耐。時間只係分析，唔會扣分。逐張分數預設不顯示。',
            'Start with the cards that differed most, who has not chosen, and average time spent. Time is analysis only, not a penalty. Per-card scores stay hidden until you turn them on.',
          )}
        </p>

        <Panel className="mt-8 px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-base font-medium" id="score-label">
                {tx('顯示分數', 'Show scores')}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {tx('預設關閉。打開後只在這一頁，不會出現在學員畫面。', 'Off by default. When on, scores stay on this page only.')}
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
          <h2 className="text-lg font-medium">{tx('與參考方向不同比較多的卡', 'Cards that differed most')}</h2>
          <p className="mt-1 text-sm text-muted">
            {tx(
              '答中比例：已核對入面同參考方向一樣嘅比例。與參考方向不同：揀咗相反。還沒選：未有選擇。平均用了：每張平均幾多秒。',
              'Match rate: share of checked answers that follow the reference. Differed: the other way. Not chosen: no choice yet. Average time: seconds spent.',
            )}
          </p>
          {analytics.cards.length === 0 ? (
            <Panel className="mt-4 px-6 py-8">
              <p className="text-base text-ink">{tx('這一場還沒有伺服器上的作答紀錄。', 'This session has no answers on the server yet.')}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {tx('學員自己看完這一套。對照回到之後，不同較多的會排在上面。', 'Learners move through the deck. After checks return, the cards that differed most rise to the top.')}
              </p>
            </Panel>
          ) : (
            <ul className="mt-4 space-y-3">
              {analytics.cards.map((card) => {
                const pictured = findCard(card.cardId)
                const line = pictured ? cardLine(pictured, lang) : card.text
                return (
                  <li key={card.cardId}>
                    <Panel className="px-5 py-5">
                      <p className="text-sm text-muted">{pictured ? (lang === 'en' ? pictured.themeEn : pictured.theme) : card.theme}</p>
                      {pictured?.imageSrc ? (
                        <img src={pictured.imageSrc} alt={line} className="mt-3 w-full max-w-[220px] rounded-2xl border border-line" />
                      ) : null}
                      <p className="mt-2 text-base leading-relaxed text-ink">{line}</p>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-blush">
                        <div className="h-full rounded-full bg-mint" style={{ width: `${Math.round((card.accuracy ?? 0) * 100)}%` }} />
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-muted">
                        {tx('答中比例', 'Match rate')} {formatPercent(card.accuracy)} · {tx('與參考方向不同', 'Differed')} {card.wrong} · {tx('還沒選', 'Not chosen')} {card.missed}
                        {card.avgMs != null ? ` · ${tx('平均用了', 'Average time')} ${formatSeconds(card.avgMs, lang)}` : ''}
                      </p>
                    </Panel>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-medium">{tx('每一組用咗幾耐', 'Time by group')}</h2>
          {groupTime.size === 0 ? (
            <p className="mt-2 text-sm text-muted">{tx('未有可以分組嘅用時。', 'No grouped times yet.')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {[...groupTime.entries()].map(([label, values]) => {
                const avg = values.reduce((sum, value) => sum + value, 0) / values.length
                return (
                  <li key={label} className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink">
                    {label} · {tx(`${values.length} 句`, `${values.length} lines`)} · {tx('平均用了', 'Average time')} {formatSeconds(avg, lang)}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-medium">{tx('人與用時', 'People and time spent')}</h2>
          <p className="mt-1 text-sm text-muted">
            {tx('還沒選較多的人在前面，其後按平均用了幾耐。唔係扣分排序。', 'People with more unchosen cards come first, then by average time spent. This is not a penalty ranking.')}
          </p>
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[28px] border border-line bg-white">
            {analytics.players.map((player) => (
              <li key={player.playerId} className="px-5 py-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-ink">
                    <Link to={`/host/debrief/${player.playerId}`} className="underline decoration-line underline-offset-4">
                      {player.name}
                    </Link>
                    {!player.connected ? <span className="text-muted"> · {tx('未連上', 'not connected')}</span> : null}
                    {player.demo ? <span className="text-muted"> · {tx('示範', 'demo')}</span> : null}
                  </p>
                  <p className="text-sm text-muted">{tx('平均用了', 'Average time')} {formatSeconds(player.avgMs, lang)}</p>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {tx('還沒選', 'Not chosen')} {player.missedCount}
                  {showScores ? tx(` · 與參考方向一致 ${player.correctCount}／${player.revealedCount}`, ` · matched ${player.correctCount}/${player.revealedCount}`) : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </Frame>
  )
}
