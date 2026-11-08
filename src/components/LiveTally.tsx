import { Link } from 'react-router-dom'
import { useGame } from '@/api/useGame'
import { Panel } from '@/components/Panel'
import { deckHasAnswerKey } from '@/domain/cards'
import { formatPercent } from '@/domain/format'
import { playOrder } from '@/domain/order'
import { tallyRate, tallySession } from '@/domain/tally'
import { useLang } from '@/i18n/lang'

export function LiveTally({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const state = useGame()
  const { tx } = useLang()
  const playing = state.room.phase === 'playing' || state.room.phase === 'paused'
  const tally = tallySession({
    keyed: deckHasAnswerKey(state.room.deck),
    players: state.players,
    answers: state.answers,
    order: playOrder(state.room.deck, state.room.code),
  })
  const rate = tallyRate(tally)

  if (variant === 'compact') {
    if (!playing || !state.room.code) return null
    return (
      <Panel className="px-5 py-5" aria-label={tx('現場計分', 'Live scoring')}>
        <h2 className="text-base font-medium">{tx('現場計分', 'Live scoring')}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {tx('本場進行中。一致與不同已自動加總，不必手算。', 'This session is in progress. Matched and differed totals are added for you.')}
        </p>
        {tally.people.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{tx('尚未有學員。示範學員不計入。', 'No learners yet. Demo learners are not scored.')}</p>
        ) : (
          <TallyTotals tally={tally} rate={rate} />
        )}
        <p className="mt-4">
          <Link to="/host/analytics#live-tally" className="text-sm text-ink underline decoration-line underline-offset-4">
            {tx('打開完整計分', 'Open the full tally')}
          </Link>
        </p>
      </Panel>
    )
  }

  return (
    <Panel id="live-tally" className="scroll-mt-6 px-5 py-5" aria-label={tx('現場計分', 'Live scoring')}>
      <h2 className="text-base font-medium">{tx('現場計分', 'Live scoring')}</h2>
      {!state.room.code || state.room.phase === 'lobby' ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {tx('開始作答之後，這裡會自動加總。不必手算。', 'After answering starts, totals appear here. You do not add them by hand.')}
        </p>
      ) : !tally.keyed ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {tx('這一套的參考答案尚未放進本場，所以暫不計分。', 'This deck has no reference key in the room yet, so there is no score.')}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {playing
              ? tx(
                  '本場仍在進行。數字只計本場已經核對的選擇，並會隨作答更新。尚未核對的選擇不計入任何一邊。',
                  'This session is still in progress. Figures count only checked choices from this session and update as answers arrive. Unchecked choices are left out of both totals.',
                )
              : tx(
                  '以下只計本場已經核對的選擇。尚未核對的選擇不計入任何一邊。',
                  'These figures count only checked choices from this session. Unchecked choices are left out of both totals.',
                )}
          </p>
          <TallyTotals tally={tally} rate={rate} />
          {tally.people.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{tx('尚未有學員。示範學員不計入。', 'No learners yet. Demo learners are not scored.')}</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                <caption className="sr-only">{tx('學員計分', 'Learner scores')}</caption>
                <thead>
                  <tr className="text-muted">
                    <th scope="col" className="px-3 py-2 font-medium">{tx('學員', 'Learner')}</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">{tx('一致', 'Matched')}</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">{tx('不同', 'Differed')}</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">{tx('未核對', 'Unchecked')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tally.people.map((person) => (
                    <tr key={person.playerId} className="border-t border-line">
                      <th scope="row" className="px-3 py-2.5 font-normal text-ink">{person.name}</th>
                      <td className="px-3 py-2.5 text-right font-latin tabular-nums text-ink">{person.matched}</td>
                      <td className="px-3 py-2.5 text-right font-latin tabular-nums text-ink">{person.differed}</td>
                      <td className="px-3 py-2.5 text-right font-latin tabular-nums text-muted">{person.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tally.cards.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-ink">{tx('不同較多的卡', 'Cards with more differences')}</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {tally.cards.slice(0, 5).map((card) => (
                  <li key={card.cardId}>
                    {tx(
                      `第 ${card.number} 張 · 不同 ${card.differed} · 一致 ${card.matched}`,
                      `Card ${card.number} · differed ${card.differed} · matched ${card.matched}`,
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : tally.people.length > 0 ? (
            <p className="mt-4 text-sm text-muted">{tx('目前沒有與參考方向不同的作答。', 'No checked answers differ from the reference yet.')}</p>
          ) : null}
        </>
      )}
    </Panel>
  )
}

function TallyTotals({
  tally,
  rate,
}: {
  tally: { matched: number; differed: number; pending: number; keyed: boolean }
  rate: number | null
}) {
  const { tx } = useLang()
  if (!tally.keyed) return null
  return (
    <>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Total label={tx('一致', 'Matched')} value={String(tally.matched)} />
        <Total label={tx('不同', 'Differed')} value={String(tally.differed)} />
        <Total label={tx('一致比例', 'Match rate')} value={formatPercent(rate)} />
      </div>
      {tally.pending > 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {tx(
            `另有 ${tally.pending} 項已交答但尚未核對，不計入上面的數字。`,
            `${tally.pending} submitted choices are not checked yet, so they are not in the totals above.`,
          )}
        </p>
      ) : null}
    </>
  )
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f7fbfe] px-3 py-3">
      <p className="font-latin text-2xl tabular-nums text-ink">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  )
}
