import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useGame } from '@/api/useGame'
import { BrandMark } from '@/components/BrandMark'
import { Frame } from '@/components/Frame'
import { SessionReportView } from '@/components/SessionReportView'
import { buildSessionReport } from '@/domain/report'
import { useLang } from '@/i18n/lang'
import { usePageTitle } from '@/lib/title'
import { answersForPlayer } from './FinalPage'

export function HostDebriefPage() {
  const state = useGame()
  const { lang, tx } = useLang()
  const params = useParams()
  const playerId = params.playerId ?? ''
  const player = state.players.find((item) => item.id === playerId)
  const name = player?.name ?? tx('這位學員', 'This learner')
  usePageTitle(tx(`信念遊戲 · ${name} 的整理`, `Belief Game · ${name}`))

  const report = useMemo(
    () =>
      buildSessionReport({
        lang,
        name,
        deck: state.room.deck,
        roomCode: state.room.code,
        answers: answersForPlayer(state.answers, playerId),
      }),
    [lang, name, playerId, state.answers, state.room.code, state.room.deck],
  )

  return (
    <Frame width="host">
      <main id="main" className="max-w-[480px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <BrandMark kicker="Host" />
          <Link to="/host/control" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
            {tx('返回主持台', 'Back to the console')}
          </Link>
        </div>
        <h1 className="mt-8 text-[1.85rem] font-medium leading-snug">
          {tx(`${name} 的整理`, `${name}'s summary`)}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {tx(
            '只使用這一場房間入面的選擇同用時。主持可以喺複盤時打開。',
            'This uses only the choices and times from this room. Open it during the debrief.',
          )}
        </p>
        <div className="mt-6">
          <SessionReportView report={report} />
        </div>
      </main>
    </Frame>
  )
}
