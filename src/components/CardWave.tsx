import { useId, useState } from 'react'
import { useGame } from '@/api/useGame'
import { Panel } from '@/components/Panel'
import { cardLine, cardTheme, findCard, optionLabel } from '@/domain/cards'
import { selectCardAnswers, selectCardWaves, type PaceGrade } from '@/domain/selectors'
import { useLang } from '@/i18n/lang'

function waveArea(points: { x: number; y: number }[], baseY: number) {
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

export function CardWave({
  pace,
  variant = 'full',
  showPlayers = false,
}: {
  pace?: PaceGrade[]
  variant?: 'full' | 'compact'
  /** 只俾主持台。學員畫面唔列出其他人嘅答案。 */
  showPlayers?: boolean
}) {
  const state = useGame()
  const { lang, tx } = useLang()
  const rawId = useId().replace(/:/g, '')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  if (state.room.phase === 'lobby') return null

  const wave = selectCardWaves(state, pace)
  const slot = variant === 'compact' ? 18 : 28
  const rise = variant === 'compact' ? 42 : 86
  const fall = rise
  const baseline = 10 + rise
  const height = baseline + fall + (variant === 'compact' ? 8 : 28)
  const width = Math.max(slot, wave.bars.length * slot)
  const answered = wave.bars.reduce((sum, bar) => sum + bar.correct + bar.wrong, 0)
  const correctTotal = wave.bars.reduce((sum, bar) => sum + bar.correct, 0)
  const wrongTotal = wave.bars.reduce((sum, bar) => sum + bar.wrong, 0)
  const selected = wave.bars.find((bar) => bar.cardId === selectedId) ?? null
  const selectedCard = selected ? findCard(selected.cardId) : null
  const selectedAnswers = showPlayers && selected ? selectCardAnswers(state, selected.cardId) : []

  const upPoints = wave.bars.map((bar, index) => ({
    x: index * slot + slot / 2,
    y: baseline - (bar.correct / wave.peak) * (rise - 8),
  }))
  const downPoints = wave.bars.map((bar, index) => ({
    x: index * slot + slot / 2,
    y: baseline + (bar.wrong / wave.peak) * (fall - 8),
  }))
  const upId = `wave-up-${rawId}`
  const downId = `wave-down-${rawId}`

  return (
    <Panel className="px-5 py-5" aria-label={tx('每一張的答中與答錯', 'Matched and differed on each card')}>
      <h2 className="text-base font-medium">{tx('每一張的現況', 'Each card, right now')}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {tx(
          '答中向上，與參考方向不同則向下。請按一條長條，查看是哪一張卡。次序是這一場打亂之後的次序。',
          'Matched grows up. Differed from the reference grows down. Press a bar to see the card. The order is this session’s shuffled order.',
        )}
      </p>
      {!wave.keyed ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          {tx('這一套的參考答案還沒放進房間，所以未有答中或答錯的條形。', 'This deck has no reference key in the room yet, so there are no bars.')}
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-[#5fbfb0]" aria-hidden="true" />
              {tx('向上 · 答中', 'Up · matched')}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-[#e07a90]" aria-hidden="true" />
              {tx('向下 · 與參考方向不同', 'Down · differed')}
            </span>
          </div>
          <div className="mt-3 overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-auto w-full min-w-[320px]"
              role="img"
              aria-label={tx(
                `五十張的條形。已對照 ${answered} 人次，答中 ${correctTotal}，與參考方向不同 ${wrongTotal}。`,
                `Bars for fifty cards. ${answered} checked answers, ${correctTotal} matched, ${wrongTotal} differed.`,
              )}
            >
              <defs>
                <linearGradient id={upId} x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#d7f6f1" />
                  <stop offset="100%" stopColor="#3fbfae" />
                </linearGradient>
                <linearGradient id={downId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffd5e0" />
                  <stop offset="100%" stopColor="#e07a90" />
                </linearGradient>
              </defs>
              <path d={waveArea(upPoints, baseline)} fill={`url(#${upId})`} opacity="0.35" />
              <path d={waveArea(downPoints, baseline)} fill={`url(#${downId})`} opacity="0.35" />
              <line x1="0" y1={baseline} x2={width} y2={baseline} stroke="#f0e4ec" strokeWidth="1.5" />
              {wave.bars.map((bar, index) => {
                const x = index * slot + 5
                const barWidth = slot - 10
                const up = (bar.correct / wave.peak) * (rise - 8)
                const down = (bar.wrong / wave.peak) * (fall - 8)
                const active = bar.cardId === selectedId
                const label = variant === 'full' && (index === 0 || bar.number % 5 === 0)
                return (
                  <g
                    key={bar.cardId}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(bar.cardId)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedId(bar.cardId)
                      }
                    }}
                  >
                    <title>
                      {tx(
                        `第 ${bar.number} 張，答中 ${bar.correct} 人，與參考方向不同 ${bar.wrong} 人`,
                        `Card ${bar.number}, matched ${bar.correct}, differed ${bar.wrong}`,
                      )}
                    </title>
                    <rect
                      x={index * slot + 1}
                      y={4}
                      width={slot - 2}
                      height={height - 8}
                      fill={active ? '#fff1f6' : 'transparent'}
                      rx={6}
                    />
                    {up > 0 ? (
                      <rect x={x} y={baseline - up} width={barWidth} height={up} rx={barWidth / 2} fill={`url(#${upId})`} />
                    ) : null}
                    {down > 0 ? (
                      <rect x={x} y={baseline} width={barWidth} height={down} rx={barWidth / 2} fill={`url(#${downId})`} />
                    ) : null}
                    {up === 0 && down === 0 ? (
                      <circle cx={index * slot + slot / 2} cy={baseline} r={2.2} fill="#e4d5de" />
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
          {selected && selectedCard ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
              <img src={selectedCard.imageSrc} alt={cardLine(selectedCard, lang)} className="mx-auto block max-h-72 w-full max-w-sm object-contain" />
              <div className="px-4 py-3">
                <p className="text-sm text-muted">
                  {cardTheme(selectedCard, lang)} · {tx(`第 ${selected.number} 張`, `Card ${selected.number}`)}
                </p>
                <p className="mt-1 text-base text-ink">{cardLine(selectedCard, lang)}</p>
                <p className="mt-2 text-sm text-muted">
                  {tx(
                    `答中 ${selected.correct} 人 · 與參考方向不同 ${selected.wrong} 人`,
                    `Matched ${selected.correct} · differed ${selected.wrong}`,
                  )}
                </p>
                {showPlayers ? (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-ink">{tx('這一張卡的學員', 'Learners on this card')}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {tx(
                        '用時由短到長。最短是最有把握，最長是最猶豫，不會扣分。',
                        'Times run shortest to longest. Shortest is most sure, longest is most hesitant. It is not a penalty.',
                      )}
                    </p>
                    {selectedAnswers.length === 0 ? (
                      <p className="mt-2 text-sm text-muted">
                        {tx('這一張還沒有人作答。', 'No one has answered this card yet.')}
                      </p>
                    ) : (
                      <>
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full min-w-[28rem] text-left text-sm text-ink">
                            <caption className="sr-only">
                              {tx('這一張卡每位學員的答案、對照與用時', 'Each learner’s answer, check, and time on this card')}
                            </caption>
                            <thead>
                              <tr className="text-xs text-muted">
                                <th scope="col" className="py-2 pr-3 font-medium">{tx('名', 'Name')}</th>
                                <th scope="col" className="py-2 pr-3 font-medium">{tx('答案', 'Answer')}</th>
                                <th scope="col" className="py-2 pr-3 font-medium">{tx('對照', 'Match')}</th>
                                <th scope="col" className="py-2 font-medium">{tx('用時（秒）', 'Time (s)')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedAnswers.map((row) => (
                                <tr
                                  key={row.playerId}
                                  className={
                                    row.fastest
                                      ? 'border-t border-line bg-blush'
                                      : row.slowest
                                        ? 'border-t border-line bg-[rgba(225,190,231,0.35)]'
                                        : 'border-t border-line'
                                  }
                                >
                                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                                    {row.left ? tx('已離開', 'Left') : row.name}
                                    {row.demo ? <span className="text-muted"> · {tx('示範', 'demo')}</span> : null}
                                  </th>
                                  <td className="py-2 pr-3">{optionLabel(selectedCard, row.optionId, lang)}</td>
                                  <td className="py-2 pr-3">
                                    <span className="inline-flex items-center gap-2">
                                      <span
                                        className={
                                          row.correct === true
                                            ? 'size-2 rounded-full bg-[#5fbfb0]'
                                            : row.correct === false
                                              ? 'size-2 rounded-full bg-[#e07a90]'
                                              : 'size-2 rounded-full bg-line'
                                        }
                                        aria-hidden="true"
                                      />
                                      {row.correct === true
                                        ? tx('答中', 'Matched')
                                        : row.correct === false
                                          ? tx('與參考方向不同', 'Differed')
                                          : tx('未核對', 'Not checked yet')}
                                    </span>
                                  </td>
                                  <td className="py-2">
                                    <span className="font-latin tabular-nums">{row.seconds}</span>
                                    {row.fastest ? (
                                      <span className="ml-2 rounded-full bg-pink px-2 py-0.5 text-xs text-ink">
                                        {tx('最有把握', 'Most sure')}
                                      </span>
                                    ) : null}
                                    {row.slowest ? (
                                      <span className="ml-2 rounded-full bg-lavender px-2 py-0.5 text-xs text-ink">
                                        {tx('最猶豫', 'Most hesitant')}
                                      </span>
                                    ) : null}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">{tx('請按一條長條，查看是哪一張卡。', 'Press a bar to see which card it is.')}</p>
          )}
        </>
      )}
    </Panel>
  )
}
