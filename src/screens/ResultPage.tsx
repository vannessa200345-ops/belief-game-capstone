import { BeliefCard } from '@/components/BeliefCard'
import { BrandMark } from '@/components/BrandMark'
import { Frame } from '@/components/Frame'
import { HostMessage } from '@/components/HostMessage'
import { NextStep } from '@/components/NextStep'
import { Panel } from '@/components/Panel'
import { SpeakControl } from '@/components/SpeakControl'
import { useGame } from '@/api/useGame'
import { cardLine, cardTheme, optionLabel } from '@/domain/cards'
import { formatSeconds } from '@/domain/format'
import { currentCard, selectMonitor, yourAnswer } from '@/domain/selectors'
import { useLang } from '@/i18n/lang'
import { usePageTitle } from '@/lib/title'

export function ResultPage() {
  const state = useGame()
  const { lang, tx } = useLang()
  const card = currentCard(state)
  const answer = card ? yourAnswer(state, card.id) : null
  const monitor = selectMonitor(state)
  const aligned = answer?.correct === true
  usePageTitle(tx('信念遊戲 · 這一輪', 'Belief Game · This round'))

  return (
    <Frame>
      <main id="main">
        <BrandMark />
        <p className="mt-8 text-sm text-muted">
          {tx(`第 ${monitor.cardNumber} 張，共 ${monitor.cardTotal} 張`, `Card ${monitor.cardNumber} of ${monitor.cardTotal}`)}
        </p>
        <h1 className="mt-2 text-[1.7rem] font-medium leading-snug">{tx('這一輪先到這裡', 'That is this round')}</h1>
        <div className="mt-3">
          <NextStep label={tx('下一步：', 'Next: ')}>
            {tx('等下一張自己出現。想講嘢可以傳字，唔使開咪。', 'wait for the next card. Text the host if you want to say something. No mic needed.')}
          </NextStep>
        </div>
        {card ? (
          <div className="mt-5">
            <BeliefCard
              theme={cardTheme(card, lang)}
              text={cardLine(card, lang)}
              imageSrc={card.imageSrc}
              caption={lang === 'en' ? card.textEn : undefined}
              compact
            />
          </div>
        ) : null}

        <Panel className="mt-5 px-5 py-5">
          {!answer ? (
            <>
              <span className="inline-flex rounded-full bg-lavender/80 px-3 py-1 text-sm text-ink">{tx('未及選擇', 'No choice yet')}</span>
              <p className="mt-4 text-base leading-relaxed">{tx('這一輪你還沒有選擇。沒有關係，下一張可以再來。', 'You have not chosen on this card. The next one is fine.')}</p>
            </>
          ) : answer.correct == null ? (
            <>
              <span className="inline-flex rounded-full bg-lavender/80 px-3 py-1 text-sm text-ink">{tx('已選好', 'Chosen')}</span>
              <p className="mt-4 text-base leading-relaxed">{tx('你的選擇已記下。對照要等伺服器回來，先不當成答錯。', 'Your choice is saved. It is not marked wrong until the check returns.')}</p>
            </>
          ) : aligned ? (
            <>
              <span className="inline-flex rounded-full bg-mint/80 px-3 py-1 text-sm text-ink">{tx('方向相近', 'Close to the reference')}</span>
              <p className="mt-4 text-base leading-relaxed">{tx('你的選擇，與這一輪的參考方向一致。', 'Your choice matches the reference for this card.')}</p>
            </>
          ) : (
            <>
              <span className="inline-flex rounded-full bg-lavender/80 px-3 py-1 text-sm text-ink">{tx('先留著', 'Leave it for now')}</span>
              <p className="mt-4 text-base leading-relaxed">{tx('你的選擇與參考方向不同。可以先留著，不必急著改口。', 'Your choice differs from the reference. You can leave it.')}</p>
            </>
          )}

          {answer && card ? (
            <p className="mt-4 text-sm leading-relaxed text-muted">
              {tx('你選了：', 'You chose: ')}
              {optionLabel(card, answer.optionId, lang)}
              <span className="mt-1 block">{tx('用了大約', 'Time spent about')} {formatSeconds(answer.ms, lang)}</span>
            </p>
          ) : null}
        </Panel>

        <p className="mt-5 text-sm leading-relaxed text-muted">{tx('下一張會自己出現。這裡不公開其他人的選擇。', 'The next card appears on its own. Other people’s choices stay private.')}</p>
        <div className="mt-4">
          <HostMessage audience="player" />
        </div>
        <div className="mt-4">
          <SpeakControl />
        </div>
      </main>
    </Frame>
  )
}
