import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGame } from '@/api/useGame'
import { Panel } from '@/components/Panel'
import { deckHasAnswerKey } from '@/domain/cards'
import { formatPercent } from '@/domain/format'
import { playOrder } from '@/domain/order'
import { personStatus, tallyRate, tallySession, type TallyPerson } from '@/domain/tally'
import { useLang } from '@/i18n/lang'
import { cn } from '@/lib/utils'

export function LiveTally({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const state = useGame()
  const { tx } = useLang()
  const [projector, setProjector] = useState(false)
  const playing = state.room.phase === 'playing' || state.room.phase === 'paused'
  const order = playOrder(state.room.deck, state.room.code)
  const tally = tallySession({
    keyed: deckHasAnswerKey(state.room.deck),
    players: state.players,
    answers: state.answers,
    order,
  })
  const rate = tallyRate(tally)
  const present = state.players.filter((player) => !player.host && !player.demo && player.connected).length
  const totalQuestions = order.length
  const ranked = [...tally.people].sort(
    (a, b) => b.matched - a.matched || a.differed - b.differed || a.name.localeCompare(b.name, 'zh-Hant'),
  )

  if (variant === 'compact') {
    if (!playing || !state.room.code) return null
    return (
      <Panel className="px-6 py-6" aria-label={tx('現場計分', 'Live scoring')}>
        <h2 className="text-base font-medium">{tx('現場計分', 'Live scoring')}</h2>
        <KpiStrip present={present} rate={rate} covered={tally.covered} totalQuestions={totalQuestions} large={false} />
        <p className="mt-6">
          <Link to="/host/analytics#live-tally" className="text-sm text-ink underline decoration-line underline-offset-4">
            {tx('打開完整計分', 'Open the full tally')}
          </Link>
        </p>
      </Panel>
    )
  }

  const ready = Boolean(state.room.code) && state.room.phase !== 'lobby' && tally.keyed

  return (
    <Panel id="live-tally" className="scroll-mt-6 px-6 py-8 sm:px-8 sm:py-10" aria-label={tx('現場計分', 'Live scoring')}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">{tx('現場計分', 'Live scoring')}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            {tx('數字只計本場已經核對的選擇，並會隨作答更新。', 'Figures count only checked choices from this session and update as answers arrive.')}
          </p>
        </div>
        {ready ? (
          <button
            type="button"
            className="rounded-full border border-line bg-white px-4 py-2 text-sm text-ink"
            aria-pressed={projector}
            onClick={() => setProjector((value) => !value)}
          >
            {projector ? tx('返回主持', 'Host view') : tx('投影', 'Projector')}
          </button>
        ) : null}
      </div>

      {!state.room.code || state.room.phase === 'lobby' ? (
        <p className="mt-8 text-sm leading-relaxed text-muted">
          {tx('開始作答之後，這裡會自動加總。不必手算。', 'After answering starts, totals appear here. You do not add them by hand.')}
        </p>
      ) : !tally.keyed ? (
        <p className="mt-8 text-sm leading-relaxed text-muted">
          {tx('這一套的參考答案尚未放進本場，所以暫不計分。', 'This deck has no reference key in the room yet, so there is no score.')}
        </p>
      ) : (
        <div className={cn(projector ? 'mt-10 space-y-12' : 'mt-8 space-y-10')}>
          <KpiStrip present={present} rate={rate} covered={tally.covered} totalQuestions={totalQuestions} large={projector} />
          {tally.pending > 0 ? (
            <p className="text-sm leading-relaxed text-muted">
              {tx(
                `另有 ${tally.pending} 項已交答但尚未核對，不計入一致或不同。`,
                `${tally.pending} submitted choices are not checked yet, so they are left out of matched and differed.`,
              )}
            </p>
          ) : null}

          <AgreementBar matched={tally.matched} differed={tally.differed} />

          <section aria-labelledby="tally-top">
            <h3 id="tally-top" className="text-base font-medium">{tx('前五名', 'Top 5')}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {tx(
                '已齊表示本套已全部核對。需跟進表示仍有未核對，或不同多於一致。',
                'Complete means every card in this deck is checked. Follow up means an answer is still unchecked, or differences outnumber matches.',
              )}
            </p>
            {ranked.length === 0 ? (
              <p className="mt-6 text-sm text-muted">{tx('尚未有學員。示範學員不計入。', 'No learners yet. Demo learners are not scored.')}</p>
            ) : (
              <ol className="mt-6 space-y-5">
                {ranked.slice(0, 5).map((person, index) => (
                  <ScoreRow key={person.playerId} person={person} rank={index + 1} totalQuestions={totalQuestions} />
                ))}
              </ol>
            )}
          </section>

          {tally.cards.length > 0 ? (
            <section aria-labelledby="tally-cards">
              <h3 id="tally-cards" className="text-base font-medium">{tx('不同較多的卡', 'Cards with more differences')}</h3>
              <ul className="mt-6 space-y-4">
                {tally.cards.slice(0, 5).map((card) => (
                  <li key={card.cardId}>
                    <div className="flex items-baseline justify-between gap-4 text-sm">
                      <span className="text-ink">{tx(`第 ${card.number} 張`, `Card ${card.number}`)}</span>
                      <span className="font-latin tabular-nums text-muted">
                        {tx(`不同 ${card.differed} · 一致 ${card.matched}`, `differed ${card.differed} · matched ${card.matched}`)}
                      </span>
                    </div>
                    <Meter
                      value={card.differed}
                      max={Math.max(card.differed + card.matched, 1)}
                      label={tx(`第 ${card.number} 張的不同比例`, `Difference share for card ${card.number}`)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : ranked.length > 0 ? (
            <p className="text-sm text-muted">{tx('目前沒有與參考方向不同的作答。', 'No checked answers differ from the reference yet.')}</p>
          ) : null}

          {!projector && ranked.length > 0 ? (
            <details className="border-t border-line pt-6">
              <summary className="cursor-pointer text-sm text-muted">
                {tx(`全部學員（${ranked.length}）`, `All learners (${ranked.length})`)}
              </summary>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[32rem] border-collapse text-left text-sm text-muted">
                  <caption className="sr-only">{tx('全部學員計分', 'All learner scores')}</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="px-2 py-2 font-medium">{tx('名次', 'Rank')}</th>
                      <th scope="col" className="px-2 py-2 font-medium">{tx('學員', 'Learner')}</th>
                      <th scope="col" className="px-2 py-2 font-medium">{tx('狀態', 'Status')}</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">{tx('一致', 'Matched')}</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">{tx('不同', 'Differed')}</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">{tx('未核對', 'Unchecked')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((person, index) => (
                      <tr key={person.playerId} className="border-t border-line">
                        <td className="px-2 py-2 font-latin tabular-nums">{index + 1}</td>
                        <td className="px-2 py-2 text-ink">{person.name}</td>
                        <td className="px-2 py-2"><StatusChip status={personStatus(person, totalQuestions)} /></td>
                        <td className="px-2 py-2 text-right font-latin tabular-nums">{person.matched}</td>
                        <td className="px-2 py-2 text-right font-latin tabular-nums">{person.differed}</td>
                        <td className="px-2 py-2 text-right font-latin tabular-nums">{person.pending}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
        </div>
      )}
    </Panel>
  )
}

function KpiStrip({
  present,
  rate,
  covered,
  totalQuestions,
  large,
}: {
  present: number
  rate: number | null
  covered: number
  totalQuestions: number
  large: boolean
}) {
  const { tx } = useLang()
  const figure = large ? 'text-6xl' : 'text-4xl sm:text-5xl'
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <Kpi label={tx('一致比例', 'Match rate')} value={formatPercent(rate)} figure={figure} />
      <Kpi label={tx('在場人數', 'People here')} value={String(present)} figure={figure} />
      <Kpi
        label={tx('已完成／總題', 'Checked / deck')}
        value={`${covered}／${totalQuestions}`}
        figure={figure}
      />
    </div>
  )
}

function Kpi({ label, value, figure }: { label: string; value: string; figure: string }) {
  return (
    <div className="px-1 py-2">
      <p className={cn('font-latin tabular-nums leading-none text-ink', figure)}>{value}</p>
      <p className="mt-3 text-sm text-muted">{label}</p>
    </div>
  )
}

function AgreementBar({ matched, differed }: { matched: number; differed: number }) {
  const { tx } = useLang()
  const total = matched + differed
  const matchWidth = total === 0 ? 0 : (matched / total) * 100
  return (
    <section aria-labelledby="tally-agreement">
      <h3 id="tally-agreement" className="text-base font-medium">{tx('一致與不同', 'Matched and differed')}</h3>
      <p className="mt-2 text-sm text-muted">
        {tx(`一致 ${matched} · 不同 ${differed}`, `Matched ${matched} · Differed ${differed}`)}
      </p>
      <div
        className="mt-4 h-4 overflow-hidden rounded-full bg-line"
        role="img"
        aria-label={tx(`一致 ${matched}，不同 ${differed}`, `Matched ${matched}, differed ${differed}`)}
      >
        <span className="block h-full bg-pink" style={{ width: `${matchWidth}%` }} />
      </div>
      {total === 0 ? (
        <p className="mt-3 text-sm text-muted">{tx('尚未有已核對的選擇。', 'No checked choices yet.')}</p>
      ) : null}
    </section>
  )
}

function ScoreRow({ person, rank, totalQuestions }: { person: TallyPerson; rank: number; totalQuestions: number }) {
  const { tx } = useLang()
  return (
    <li>
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-6 font-latin text-sm tabular-nums text-muted">{rank}</span>
        <span className="text-base text-ink">{person.name}</span>
        <StatusChip status={personStatus(person, totalQuestions)} />
        <span className="ml-auto font-latin text-sm tabular-nums text-muted">
          {person.matched}／{totalQuestions}
        </span>
      </div>
      <div className="mt-2 pl-9">
        <Meter
          value={person.matched}
          max={Math.max(totalQuestions, 1)}
          label={tx(`${person.name}的一致題數`, `Matched cards for ${person.name}`)}
        />
      </div>
    </li>
  )
}

function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const width = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="mt-2 h-2 rounded-full bg-line" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="h-full rounded-full bg-pink" style={{ width: `${width}%` }} />
    </div>
  )
}

function StatusChip({ status }: { status: 'done' | 'follow' | 'open' }) {
  const { tx } = useLang()
  const label = status === 'done' ? tx('已齊', 'Complete') : status === 'follow' ? tx('需跟進', 'Follow up') : tx('未齊', 'In progress')
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-xs',
        status === 'done' ? 'bg-pink text-ink' : status === 'follow' ? 'bg-blush text-ink' : 'border border-line text-muted',
      )}
    >
      {label}
    </span>
  )
}
