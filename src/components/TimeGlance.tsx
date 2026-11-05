import { useGame } from '@/api/useGame'
import { Panel } from '@/components/Panel'
import { cardLine, findCard } from '@/domain/cards'
import { selectSessionTime, type TimedPoint } from '@/domain/selectors'
import { useLang } from '@/i18n/lang'

function secondsText(seconds: number, en: boolean) {
  return en ? `${seconds}s` : `${seconds} 秒`
}

export function TimeGlance() {
  const state = useGame()
  const { lang, tx } = useLang()
  const glance = selectSessionTime(state)
  const en = lang === 'en'

  function cardLabel(point: TimedPoint) {
    const card = findCard(point.id)
    const line = card ? cardLine(card, lang) : ''
    return tx(
      `第 ${point.number} 張 · 平均 ${secondsText(point.avgSeconds, false)} · ${line}`,
      `Card ${point.number} · average ${secondsText(point.avgSeconds, true)} · ${line}`,
    )
  }

  function personLabel(point: TimedPoint) {
    const name = point.left ? tx('已離開', 'Left') : point.name
    return tx(
      `${name} · 平均 ${secondsText(point.avgSeconds, false)}`,
      `${name} · average ${secondsText(point.avgSeconds, true)}`,
    )
  }

  const cards = glance.shortestCard && glance.longestCard ? [glance.shortestCard, glance.longestCard] : null
  const people = glance.fastestPerson && glance.slowestPerson ? [glance.fastestPerson, glance.slowestPerson] : null

  return (
    <Panel className="px-5 py-5" aria-label={tx('用時分析', 'Time analysis')}>
      <h2 className="text-base font-medium text-ink">{tx('用時分析', 'Time analysis')}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {tx(
          '最短係最有把握，最長係最猶豫。只用呢一場已儲存嘅用時，唔會扣分。',
          'Shortest means most sure. Longest means most hesitant. This uses only time stored for this session. It is not a penalty.',
        )}
      </p>
      {glance.cardsWithTime === 0 ? (
        <p className="mt-3 text-sm text-muted">{tx('呢一場未有用時。', 'No answer times in this session yet.')}</p>
      ) : (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {cards ? (
            <>
              <GlanceItem term={tx('最有把握的卡', 'Most sure card')} detail={cardLabel(cards[0])} />
              <GlanceItem term={tx('最猶豫的卡', 'Most hesitant card')} detail={cardLabel(cards[1])} hesitant />
            </>
          ) : (
            <p className="text-sm leading-relaxed text-muted sm:col-span-2">
              {en
                ? 'Card times are stored. There is not yet a shorter and a longer card to compare.'
                : '卡嘅用時已經記低。而家未有一張明顯較短、一張明顯較長。'}
            </p>
          )}
          {people ? (
            <>
              <GlanceItem term={tx('最快的人', 'Fastest person')} detail={personLabel(people[0])} />
              <GlanceItem term={tx('最慢的人', 'Slowest person')} detail={personLabel(people[1])} hesitant />
            </>
          ) : (
            <p className="text-sm leading-relaxed text-muted sm:col-span-2">
              {en
                ? 'Not enough people with different times to name a fastest and a slowest person.'
                : '未有兩位用時不同嘅人，所以未標最快同最慢。'}
            </p>
          )}
        </dl>
      )}
    </Panel>
  )
}

function GlanceItem({ term, detail, hesitant = false }: { term: string; detail: string; hesitant?: boolean }) {
  return (
    <div className={hesitant ? 'rounded-2xl bg-[rgba(225,190,231,0.35)] px-4 py-3' : 'rounded-2xl bg-blush px-4 py-3'}>
      <dt className="text-xs text-muted">{term}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-ink">{detail}</dd>
    </div>
  )
}
