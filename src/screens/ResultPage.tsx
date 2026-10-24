import { BeliefCard } from '@/components/BeliefCard'
import { BrandMark } from '@/components/BrandMark'
import { Frame } from '@/components/Frame'
import { Panel } from '@/components/Panel'
import { SpeakControl } from '@/components/SpeakControl'
import { useGame } from '@/api/useGame'
import { optionLabel } from '@/domain/cards'
import { formatSeconds } from '@/domain/format'
import { currentCard, selectMonitor, yourAnswer } from '@/domain/selectors'
import { usePageTitle } from '@/lib/title'

export function ResultPage() {
  const state = useGame()
  const card = currentCard(state)
  const answer = card ? yourAnswer(state, card.id) : null
  const monitor = selectMonitor(state)
  const aligned = answer?.correct === true
  usePageTitle('信念遊戲 · 這一輪')

  return (
    <Frame>
      <main id="main">
        <BrandMark />
        <p className="mt-8 text-sm text-muted">
          第 {monitor.cardNumber} 張，共 {monitor.cardTotal} 張
        </p>
        <h1 className="mt-2 text-[1.7rem] font-medium leading-snug">這一輪先到這裡</h1>
        {card ? (
          <div className="mt-5">
            <BeliefCard theme={card.theme} text={card.text} imageSrc={card.imageSrc} compact />
          </div>
        ) : null}

        <Panel className="mt-5 px-5 py-5">
          {!answer ? (
            <>
              <span className="inline-flex rounded-full bg-lavender/80 px-3 py-1 text-sm text-ink">未及選擇</span>
              <p className="mt-4 text-base leading-relaxed">這一輪你還沒有選擇。沒有關係，下一張可以再來。</p>
            </>
          ) : answer.correct == null ? (
            <>
              <span className="inline-flex rounded-full bg-lavender/80 px-3 py-1 text-sm text-ink">已選好</span>
              <p className="mt-4 text-base leading-relaxed">你的選擇已記下。對照要等伺服器回來，先不當成答錯。</p>
            </>
          ) : aligned ? (
            <>
              <span className="inline-flex rounded-full bg-mint/80 px-3 py-1 text-sm text-ink">方向相近</span>
              <p className="mt-4 text-base leading-relaxed">你的選擇，與這一輪的參考方向一致。</p>
            </>
          ) : (
            <>
              <span className="inline-flex rounded-full bg-lavender/80 px-3 py-1 text-sm text-ink">先留著</span>
              <p className="mt-4 text-base leading-relaxed">你的選擇與參考方向不同。可以先留著，不必急著改口。</p>
            </>
          )}

          {answer && card ? (
            <p className="mt-4 text-sm leading-relaxed text-muted">
              你選了：{optionLabel(card, answer.optionId)}
              <span className="mt-1 block">用了大約 {formatSeconds(answer.ms)}</span>
            </p>
          ) : null}
        </Panel>

        <p className="mt-5 text-sm leading-relaxed text-muted">下一張會自己出現。這裡不公開其他人的選擇。</p>
        <div className="mt-4">
          <SpeakControl />
        </div>
      </main>
    </Frame>
  )
}
