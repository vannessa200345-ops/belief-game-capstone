import { useId, useState } from 'react'
import { useGame } from '@/api/useGame'
import { Panel } from '@/components/Panel'
import { cardLine, cardTheme, findCard } from '@/domain/cards'
import { selectSessionTime, type SessionTimeBar } from '@/domain/selectors'
import { useLang } from '@/i18n/lang'

function timeArea(points: { x: number; y: number }[], baseY: number) {
  const first = points[0]
  if (!first) return ''
  let path = `M ${first.x.toFixed(1)} ${baseY.toFixed(1)} L ${first.x.toFixed(1)} ${first.y.toFixed(1)}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    if (!current || !next) continue
    const mid = (current.x + next.x) / 2
    path += ` C ${mid.toFixed(1)} ${current.y.toFixed(1)}, ${mid.toFixed(1)} ${next.y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`
  }
  const last = points[points.length - 1]
  if (!last) return path
  path += ` L ${last.x.toFixed(1)} ${baseY.toFixed(1)} Z`
  return path
}

/** 未作答的高度為 0。已儲存用時但平均為 0 秒時，保留短柱，以便與尚未作答區分。 */
function barHeight(bar: SessionTimeBar, peakSeconds: number, usable: number) {
  if (bar.answers === 0) return 0
  if (peakSeconds <= 0 || bar.avgSeconds <= 0) return 4
  return (bar.avgSeconds / peakSeconds) * usable
}

export function TimeGlance() {
  const state = useGame()
  const { lang, tx } = useLang()
  const glance = selectSessionTime(state)
  const rawId = useId().replace(/:/g, '')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const slot = 28
  const rise = 86
  const usable = rise - 8
  const baseline = 10 + rise
  const height = baseline + 28
  const width = Math.max(slot, glance.bars.length * slot)
  const selected = glance.bars.find((bar) => bar.id === selectedId) ?? null
  const selectedCard = selected ? findCard(selected.id) : null
  const fillId = `time-fill-${rawId}`
  const detailId = `time-detail-${rawId}`

  const points = glance.bars.map((bar, index) => ({
    x: index * slot + slot / 2,
    y: baseline - barHeight(bar, glance.peakSeconds, usable),
  }))

  function choose(cardId: string) {
    setSelectedId(cardId)
  }

  const wash = selected?.mostHesitant
    ? 'bg-[rgba(225,190,231,0.28)]'
    : selected?.mostSure
      ? 'bg-blush'
      : 'bg-white'

  return (
    <Panel className="px-5 py-5" aria-label={tx('用時分析', 'Time analysis')}>
      <h2 className="text-base font-medium text-ink">{tx('用時分析', 'Time analysis')}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {tx(
          '最短用時即最有把握，最長用時即最猶豫。僅使用本場已儲存的用時，不會扣分。',
          'The shortest time is most sure. The longest time is most hesitant. Only time stored for this session is used. Points are not deducted.',
        )}
      </p>
      {glance.cardsWithTime === 0 ? (
        <p className="mt-3 text-sm text-muted">{tx('本場尚未儲存用時。', 'No answer times have been stored for this session.')}</p>
      ) : (
        <>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {tx(
              '長條高度為平均用時，單位為秒。用時愈長，長條愈高。點擊長條以查看該卡。次序依本場亂序後的卡序排列。',
              'Bar height is the average time in seconds. The longer the time, the higher the bar. Click a bar to view that card. Bars follow this session’s shuffled card order.',
            )}
          </p>
          {!glance.longestCard ? (
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {tx(
                '各卡用時已經儲存。目前沒有可區分的最短用時與最長用時。',
                'Card times are stored. There is not yet a distinct shortest time and longest time to compare.',
              )}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block h-8 w-3 rounded-full bg-[linear-gradient(to_top,#f8bbd0,#c084c8)]"
                aria-hidden="true"
              />
              {tx('縱軸：平均用時（秒）', 'Vertical axis: average time (seconds)')}
            </span>
            {glance.longestCard && glance.shortestCard ? (
              <span className="text-ink">
                {tx('最短用時', 'Shortest time')}{' '}
                <span className="font-latin tabular-nums">{glance.shortestCard.avgSeconds}</span>
                {tx(' 秒', ' seconds')}
                {' · '}
                {tx('最長用時', 'Longest time')}{' '}
                <span className="font-latin tabular-nums">{glance.longestCard.avgSeconds}</span>
                {tx(' 秒', ' seconds')}
              </span>
            ) : (
              <span className="text-ink">
                {tx('已儲存用時均為', 'Stored times are all')}{' '}
                <span className="font-latin tabular-nums">{glance.peakSeconds}</span>
                {tx(' 秒', ' seconds')}
              </span>
            )}
          </div>
          <div className="mt-3 overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-auto w-full min-w-[320px]"
              role="group"
              aria-label={tx(
                `用時長條。已有用時 ${glance.cardsWithTime} 張，最長用時 ${glance.peakSeconds} 秒。用時愈長，長條愈高。`,
                `Time bars. ${glance.cardsWithTime} cards with stored time. Longest time ${glance.peakSeconds} seconds. The longer the time, the higher the bar.`,
              )}
            >
              <defs>
                <linearGradient id={fillId} x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#f8bbd0" />
                  <stop offset="100%" stopColor="#c084c8" />
                </linearGradient>
              </defs>
              <path d={timeArea(points, baseline)} fill={`url(#${fillId})`} opacity="0.35" />
              <line x1="0" y1={baseline} x2={width} y2={baseline} stroke="#f0e4ec" strokeWidth="1.5" />
              {glance.bars.map((bar, index) => {
                const x = index * slot + 5
                const barWidth = slot - 10
                const up = barHeight(bar, glance.peakSeconds, usable)
                const active = bar.id === selectedId
                const label = index === 0 || bar.number % 5 === 0
                const peakLabel = glance.peakSeconds > 0 && bar.answers > 0 && bar.avgSeconds === glance.peakSeconds
                const name =
                  bar.answers === 0
                    ? tx(`第 ${bar.number} 張，尚無用時`, `Card ${bar.number}, no time stored`)
                    : tx(`第 ${bar.number} 張，平均用時 ${bar.avgSeconds} 秒`, `Card ${bar.number}, average time ${bar.avgSeconds} seconds`)
                return (
                  <g
                    key={bar.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={active}
                    aria-label={name}
                    className="cursor-pointer outline-none"
                    onClick={() => choose(bar.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        choose(bar.id)
                      }
                    }}
                  >
                    <title>{name}</title>
                    <rect x={index * slot + 1} y={4} width={slot - 2} height={height - 8} fill={active ? '#fff1f6' : 'transparent'} rx={6} />
                    {up > 0 ? (
                      <rect x={x} y={baseline - up} width={barWidth} height={up} rx={barWidth / 2} fill={`url(#${fillId})`} />
                    ) : (
                      <circle cx={index * slot + slot / 2} cy={baseline} r={2.2} fill="#e4d5de" />
                    )}
                    {peakLabel ? (
                      <text
                        x={index * slot + slot / 2}
                        y={Math.max(12, baseline - up - 4)}
                        textAnchor="middle"
                        fill="#6b6570"
                        fontSize="10"
                        fontFamily="Outfit, sans-serif"
                      >
                        {bar.avgSeconds}
                      </text>
                    ) : null}
                    {label ? (
                      <text x={index * slot + slot / 2} y={height - 6} textAnchor="middle" fill="#6b6570" fontSize="9">
                        {bar.number}
                      </text>
                    ) : null}
                  </g>
                )
              })}
            </svg>
          </div>
          <div id={detailId} className="mt-4" aria-live="polite">
            {selected ? (
              <div className={`overflow-hidden rounded-2xl border border-line ${wash}`}>
                {selectedCard?.imageSrc ? (
                  <img
                    src={selectedCard.imageSrc}
                    alt={cardLine(selectedCard, lang)}
                    className="mx-auto block max-h-72 w-full max-w-sm object-contain"
                  />
                ) : null}
                <div className="px-4 py-4">
                  <p className="text-sm text-muted">
                    {selectedCard ? `${cardTheme(selectedCard, lang)} · ` : null}
                    {tx(`第 ${selected.number} 張`, `Card ${selected.number}`)}
                  </p>
                  {selectedCard ? <p className="mt-1 text-base leading-relaxed text-ink">{cardLine(selectedCard, lang)}</p> : null}
                  {selected.answers > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-ink">
                        <span className="font-latin text-[1.75rem] font-medium tabular-nums leading-none">{selected.avgSeconds}</span>
                        <span className="ml-1 text-sm text-muted">{tx('秒', 'seconds')}</span>
                      </p>
                      <p className="text-sm text-muted">{tx('平均用時', 'Average time')}</p>
                      {selected.mostSure ? (
                        <span className="rounded-full bg-pink px-2 py-0.5 text-xs text-ink">{tx('最有把握', 'Most sure')}</span>
                      ) : null}
                      {selected.mostHesitant ? (
                        <span className="rounded-full bg-lavender px-2 py-0.5 text-xs text-ink">{tx('最猶豫', 'Most hesitant')}</span>
                      ) : null}
                      <p className="w-full text-sm text-muted">
                        {tx(`已作答 ${selected.answers} 人`, `Answers recorded: ${selected.answers}`)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted">{tx('此卡尚無用時。', 'No time has been stored for this card.')}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">
                {tx(
                  '點擊長條以查看該卡與平均用時。最高長條為最長用時。',
                  'Click a bar to view that card and its average time. The tallest bar is the longest time.',
                )}
              </p>
            )}
          </div>
        </>
      )}
    </Panel>
  )
}
