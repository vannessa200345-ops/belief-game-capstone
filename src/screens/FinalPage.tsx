import { useState, type FormEvent } from 'react'
import { api } from '@/api'
import { useGame } from '@/api/useGame'
import { BrandMark } from '@/components/BrandMark'
import { CardWave } from '@/components/CardWave'
import { Leaderboard } from '@/components/Leaderboard'
import { SelfPaceNotice } from '@/components/SelfPaceNotice'
import { NoticeEmailField } from '@/components/NoticeEmailField'
import { Frame } from '@/components/Frame'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { deckHasAnswerKey, findCard } from '@/domain/cards'
import { formatSeconds } from '@/domain/format'
import { selectPersonal, youPlayer } from '@/domain/selectors'
import { scoreTier } from '@/domain/tiers'
import { usePace } from '@/self/pace'
import { usePageTitle } from '@/lib/title'

export function FinalPage() {
  const state = useGame()
  const review = selectPersonal(state)
  const pace = usePace(state.room.code)
  const you = youPlayer(state)
  const [email, setEmail] = useState(you?.email ?? '')
  const [notice, setNotice] = useState<string | null>(null)
  const [noticeError, setNoticeError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [saving, setSaving] = useState(false)
  usePageTitle('信念遊戲 · 今天的整理')

  async function leave() {
    setPending(true)
    await api.leaveRoom()
    setPending(false)
  }

  async function saveEmail(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setNotice(null)
    setNoticeError(null)
    const result = await api.saveNoticeEmail(email)
    if (!result.ok) {
      setNoticeError(result.error)
    } else if (result.email) {
      setNotice('已記下。下一場若要通知，會寄到這個電郵。這一頁現在不會寄出。')
    } else {
      setNotice('這次先不留電郵。下一場不會用電郵通知你。')
    }
    setSaving(false)
  }

  const paceTotal = pace.answers.length
  const graded = paceTotal > 0 && pace.answers.every((answer) => answer.isCorrect !== null)
  const paceCorrect = pace.answers.filter((answer) => answer.isCorrect === true).length
  const paceWrong = pace.answers.filter((answer) => answer.isCorrect === false)
  const tier = graded ? scoreTier(paceCorrect, paceTotal) : review && review.total > 0 && review.wrong + review.correct === review.total
    ? scoreTier(review.correct, review.total)
    : null
  const avgMs =
    paceTotal > 0
      ? pace.answers.reduce((sum, answer) => sum + answer.ms, 0) / paceTotal
      : review?.avgMs ?? null
  const revisit = paceWrong
    .map((answer) => findCard(answer.cardId)?.text)
    .filter((text): text is string => Boolean(text))
    .slice(0, 3)

  return (
    <Frame>
      <main id="main">
        <BrandMark />
        <h1 className="mt-12 text-[1.85rem] font-medium leading-snug">今天先到這裡</h1>
        <div className="mt-3">
          <SelfPaceNotice link={state.selfPaceLink} />
        </div>
        <p className="mt-3 text-base leading-relaxed text-muted">
          {review
            ? `${review.name}，這是留給你自己的整理。排名只計這一場答中幾多題。`
            : '這是留給你自己的整理。排名只計這一場答中幾多題。'}
        </p>

        <Panel className="mt-8 px-6 py-6">
          <h2 className="text-base font-medium">你較需要再停一停的地方</h2>
          {graded ? (
            <p className="mt-3 text-base leading-relaxed text-ink">
              你得到 {paceCorrect} 分。{paceTotal} 題裡，答中 {paceCorrect} 題。
            </p>
          ) : null}
          {paceTotal === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-muted">這一場你還沒有留下選擇。</p>
          ) : !graded ? (
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {deckHasAnswerKey(state.room.deck)
                ? `你已看了 ${paceTotal} 張。伺服器還沒把對照送回來，所以這裡先不顯示分數。`
                : `你已選了 ${paceTotal} 張。這一套的參考答案還沒放進房間，所以先不計分。`}
            </p>
          ) : revisit.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-muted">
              這 {paceTotal} 句都與參考方向相近。若還想留低一會兒，也可以。
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {revisit.map((text) => (
                <li key={text} className="rounded-2xl bg-blush px-4 py-3 text-sm text-ink">
                  {text}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="mt-4">
          <CardWave pace={pace.answers} variant="compact" />
        </div>
        <div className="mt-4">
          <Leaderboard pace={pace.answers} />
        </div>

        <Panel className="mt-4 px-6 py-6">
          <h2 className="text-base font-medium">時間</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {avgMs != null
              ? `你平均大約 ${formatSeconds(avgMs)} 看完一張。這個數字只給你自己。`
              : '你這一場還沒有留下作答時間。'}
          </p>
        </Panel>

        <details className="mt-4 rounded-[28px] border border-line bg-white px-6 py-4">
          <summary className="cursor-pointer text-sm text-ink">想看自己的對照紀錄</summary>
          {review ? (
            <>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {graded
                  ? `${paceTotal} 句裡，${paceCorrect} 次與參考方向一致，${paceWrong.length} 次不同。這裡不列出每一張的答案。`
                  : review
                    ? `${review.total} 張裡，已核對的一致次數是 ${review.correct}。未核對的不會算成答錯。`
                    : '這一場還沒有個人紀錄。'}
              </p>
              {tier ? (
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  暫定分階是「{tier}」。只給你自己看，不會公開比較。
                </p>
              ) : null}
            </>
          ) : null}
        </details>

        <Panel className="mt-4 px-6 py-6">
          <h2 className="text-base font-medium">下一場通知</h2>
          <form className="mt-4" noValidate onSubmit={(event) => void saveEmail(event)}>
            <NoticeEmailField id="final-email" value={email} onChange={setEmail} />
            {noticeError ? (
              <p className="mt-3 text-sm text-ink" role="alert">
                {noticeError}
              </p>
            ) : null}
            {notice ? <p className="mt-3 text-sm leading-relaxed text-muted">{notice}</p> : null}
            <Button className="mt-4" variant="outline" type="submit" disabled={saving}>
              {saving ? '正在記下' : '記下電郵'}
            </Button>
          </form>
        </Panel>

        <p className="mt-6 text-sm leading-relaxed text-muted">
          課後若要再約，跟主持說一聲就好。這裡不會自動傳訊息，也不會替你打開視像。
        </p>
        <Button className="mt-6" variant="ghost" onClick={() => void leave()} disabled={pending}>
          離開房間
        </Button>
      </main>
    </Frame>
  )
}
