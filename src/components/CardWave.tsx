import { useGame } from '@/api/useGame'
import { Panel } from '@/components/Panel'
import { selectCardWaves, type PaceGrade } from '@/domain/selectors'

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
}: {
  pace?: PaceGrade[]
  variant?: 'full' | 'compact'
}) {
  const state = useGame()
  if (state.room.phase === 'lobby') return null

  const wave = selectCardWaves(state, pace)
  const slot = 20
  const rise = variant === 'compact' ? 34 : 62
  const fall = rise
  const baseline = 8 + rise
  const height = baseline + fall + (variant === 'compact' ? 6 : 20)
  const width = Math.max(slot, wave.bars.length * slot)
  const answered = wave.bars.reduce((sum, bar) => sum + bar.correct + bar.wrong, 0)
  const correctTotal = wave.bars.reduce((sum, bar) => sum + bar.correct, 0)
  const wrongTotal = wave.bars.reduce((sum, bar) => sum + bar.wrong, 0)

  const upPoints = wave.bars.map((bar, index) => ({
    x: index * slot + slot / 2,
    y: baseline - (bar.correct / wave.peak) * (rise - 6),
  }))
  const downPoints = wave.bars.map((bar, index) => ({
    x: index * slot + slot / 2,
    y: baseline + (bar.wrong / wave.peak) * (fall - 6),
  }))

  return (
    <Panel className="px-5 py-5" aria-label="每一張的答中與答錯">
      <h2 className="text-base font-medium">每一張，而家</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        答中向上，答錯向下。人多，條形就長些。只計這一場人數，不顯示答案。
      </p>
      {!wave.keyed ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">這一套的參考答案還沒放進房間，所以未有答中或答錯的條形。</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-[#8ecfc4]" aria-hidden="true" />
              向上 · 答中
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-[#f0b0c0]" aria-hidden="true" />
              向下 · 答錯
            </span>
          </div>
          <div className="mt-3 overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-auto w-full min-w-[280px]"
              role="img"
              aria-label={`五十張的軟條形。已對照 ${answered} 人次，答中 ${correctTotal}，答錯 ${wrongTotal}。`}
            >
              <defs>
                <linearGradient id="wave-up" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#c9efe8" />
                  <stop offset="100%" stopColor="#7dcec2" />
                </linearGradient>
                <linearGradient id="wave-down" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f8d5df" />
                  <stop offset="100%" stopColor="#e7a3b6" />
                </linearGradient>
              </defs>
              <path d={waveArea(upPoints, baseline)} fill="url(#wave-up)" opacity="0.45" />
              <path d={waveArea(downPoints, baseline)} fill="url(#wave-down)" opacity="0.5" />
              <line x1="0" y1={baseline} x2={width} y2={baseline} stroke="#f0e4ec" strokeWidth="1.5" />
              {wave.bars.map((bar, index) => {
                const x = index * slot + 4
                const barWidth = slot - 8
                const up = (bar.correct / wave.peak) * (rise - 6)
                const down = (bar.wrong / wave.peak) * (fall - 6)
                const label = index === 0 || bar.number % 10 === 0
                return (
                  <g key={bar.cardId}>
                    <title>{`第 ${bar.number} 張，答中 ${bar.correct} 人，答錯 ${bar.wrong} 人`}</title>
                    {up > 0 ? (
                      <rect
                        x={x}
                        y={baseline - up}
                        width={barWidth}
                        height={up}
                        rx={barWidth / 2}
                        fill="url(#wave-up)"
                      />
                    ) : null}
                    {down > 0 ? (
                      <rect x={x} y={baseline} width={barWidth} height={down} rx={barWidth / 2} fill="url(#wave-down)" />
                    ) : null}
                    {variant === 'full' && label ? (
                      <text x={index * slot + slot / 2} y={height - 4} textAnchor="middle" fill="#6b6570" fontSize="8">
                        {bar.number}
                      </text>
                    ) : null}
                  </g>
                )
              })}
            </svg>
          </div>
          <p className="sr-only" aria-live="polite">
            {answered === 0
              ? '還沒有已核對的選擇。'
              : `已對照 ${answered} 人次，答中 ${correctTotal}，答錯 ${wrongTotal}。`}
          </p>
        </>
      )}
    </Panel>
  )
}
