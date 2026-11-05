import { useMemo, useState } from 'react'
import { api } from '@/api'
import { useGame } from '@/api/useGame'
import { BrandMark } from '@/components/BrandMark'
import { CardWave } from '@/components/CardWave'
import { HostMessage } from '@/components/HostMessage'
import { Leaderboard } from '@/components/Leaderboard'
import { NextStep } from '@/components/NextStep'
import { SelfPaceNotice } from '@/components/SelfPaceNotice'
import { SessionReportView } from '@/components/SessionReportView'
import { Frame } from '@/components/Frame'
import { Button } from '@/components/ui/button'
import { buildSessionReport, type ReportAnswer } from '@/domain/report'
import { youPlayer } from '@/domain/selectors'
import { useLang } from '@/i18n/lang'
import { usePageTitle } from '@/lib/title'
import { usePace } from '@/self/pace'

export function answersForPlayer(
  answers: { playerId: string; cardId: string; optionId: string; ms: number; correct: boolean | null }[],
  playerId: string | null,
  pace?: { cardId: string; choiceId: 'yes' | 'no'; ms: number; isCorrect: boolean | null }[],
): ReportAnswer[] {
  const byId = new Map<string, ReportAnswer>()
  if (playerId) {
    for (const answer of answers) {
      if (answer.playerId !== playerId) continue
      if (answer.optionId !== 'yes' && answer.optionId !== 'no') continue
      byId.set(answer.cardId, {
        cardId: answer.cardId,
        choiceId: answer.optionId,
        ms: answer.ms,
        correct: answer.correct,
      })
    }
  }
  if (playerId && pace) {
    for (const answer of pace) {
      const previous = byId.get(answer.cardId)
      byId.set(answer.cardId, {
        cardId: answer.cardId,
        choiceId: answer.choiceId,
        ms: answer.ms,
        correct: answer.isCorrect ?? previous?.correct ?? null,
      })
    }
  }
  return [...byId.values()]
}

export function FinalPage() {
  const state = useGame()
  const { lang, tx } = useLang()
  const pace = usePace(state.room.code)
  const you = youPlayer(state)
  const [pending, setPending] = useState(false)
  usePageTitle(tx('信念遊戲 · 今天的整理', 'Belief Game · Your session'))

  const report = useMemo(
    () =>
      buildSessionReport({
        lang,
        name: you?.name ?? tx('你', 'You'),
        deck: state.room.deck,
        roomCode: state.room.code,
        answers: answersForPlayer(state.answers, state.youId, pace.answers),
      }),
    [lang, pace.answers, state.answers, state.room.code, state.room.deck, state.youId, tx, you?.name],
  )

  async function leave() {
    setPending(true)
    await api.leaveRoom()
    setPending(false)
  }

  return (
    <Frame>
      <main id="main">
        <BrandMark />
        <h1 className="mt-8 text-[1.85rem] font-medium leading-snug">{tx('今天先到這裡', 'That is enough for today')}</h1>
        <div className="mt-3">
          <SelfPaceNotice link={state.selfPaceLink} />
        </div>
        <p className="mt-3 text-base leading-relaxed text-muted">
          {tx(
            `${report.name}，這是留給你自己的整理。排名只計這一場答中幾多題。`,
            `${report.name}, this summary is for you. The rank only counts how many lines matched in this session.`,
          )}
        </p>
        <div className="mt-4">
          <NextStep label={tx('下一步：', 'Next: ')}>
            {tx('睇下面嘅整理，可以下載圖片，或者傳字俾主持。', 'read the summary below, download a picture, or text the host.')}
          </NextStep>
        </div>
        <div className="mt-4">
          <SessionReportView report={report} />
        </div>
        <div className="mt-4">
          <CardWave pace={pace.answers} variant="compact" />
        </div>
        <div className="mt-4">
          <Leaderboard pace={pace.answers} />
        </div>
        <div className="mt-4">
          <HostMessage audience="player" />
        </div>
        <Button className="mt-6" variant="ghost" onClick={() => void leave()} disabled={pending}>
          {tx('離開房間', 'Leave the room')}
        </Button>
      </main>
    </Frame>
  )
}
