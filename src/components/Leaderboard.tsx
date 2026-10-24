import { useGame } from '@/api/useGame'
import { Panel } from '@/components/Panel'
import { selectLeaderboard, type PaceGrade } from '@/domain/selectors'
import { cn } from '@/lib/utils'

export function Leaderboard({
  pace,
  variant = 'full',
}: {
  pace?: PaceGrade[]
  variant?: 'full' | 'compact'
}) {
  const state = useGame()
  if (state.room.phase === 'lobby') return null

  const board = selectLeaderboard(state, pace)
  const limit = variant === 'compact' ? 5 : board.rows.length
  const top = board.rows.slice(0, limit)
  const youHidden = board.you != null && !top.some((row) => row.playerId === board.you?.playerId)

  return (
    <Panel className="px-5 py-5" aria-label="這一場排名">
      <h2 className="text-base font-medium">這一場排名</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        只計這一場答中幾多題。不會帶到下一場，也不會顯示答案。
      </p>
      {!board.keyed ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">這一套的參考答案還沒放進房間，所以暫不排名。</p>
      ) : board.rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink">未有學員入榜。</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {top.map((row) => (
            <li
              key={row.playerId}
              className={cn(
                'flex items-center justify-between gap-3 rounded-2xl px-4 py-2.5',
                row.you ? 'bg-blush' : 'bg-[#f7fbfe]',
              )}
            >
              <span className="min-w-0 text-sm text-ink">
                <span className="mr-3 inline-block w-5 text-muted">{row.rank}</span>
                <span className="break-all">{row.name}</span>
                {row.you ? <span className="text-muted"> · 你</span> : null}
              </span>
              <span className="shrink-0 text-sm text-muted">{row.correct} 分</span>
            </li>
          ))}
        </ol>
      )}
      {board.keyed && youHidden && board.you ? (
        <p className="mt-3 text-sm text-ink">
          你的名次是第 {board.you.rank}，{board.you.correct} 分。
        </p>
      ) : null}
    </Panel>
  )
}
