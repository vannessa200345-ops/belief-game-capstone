import { useState } from 'react'
import { formatSeconds } from '@/domain/format'
import type { SessionReport } from '@/domain/report'
import { downloadSessionReport } from '@/report/exportReport'
import { useLang } from '@/i18n/lang'
import { Button } from './ui/button'
import { Panel } from './Panel'

export function SessionReportView({ report }: { report: SessionReport }) {
  const { lang, tx } = useLang()
  const [exporting, setExporting] = useState<'png' | 'jpeg' | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  async function save(format: 'png' | 'jpeg') {
    setExporting(format)
    setExportError(null)
    try {
      await downloadSessionReport(report, format, lang)
    } catch {
      setExportError(tx('下載未成功，請再試一次。', 'The download did not finish. Try again.'))
    }
    setExporting(null)
  }

  return (
    <div className="space-y-4">
      <Panel className="px-6 py-6">
        <h2 className="text-base font-medium">{tx('呢一場數字', 'This session')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {tx(
            '答中比例：已核對嘅選擇入面，同參考方向一樣嘅比例。與參考方向不同：呢場揀咗相反。還沒選：呢場未有選擇。平均用了：每張用咗幾多秒。時間只係分析，唔會扣分。',
            'Match rate: share of checked choices that follow the reference. Differed: choices that went the other way. Not chosen: cards with no choice yet. Average time: seconds spent per card. Time is analysis only, not a penalty.',
          )}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Stat label={tx('答中', 'Matched')} value={report.graded ? String(report.correct) : '—'} />
          <Stat label={tx('與參考方向不同', 'Differed from reference')} value={report.graded ? String(report.wrong) : '—'} />
          <Stat label={tx('還沒選', 'Not chosen')} value={String(report.missed)} />
          <Stat label={tx('平均用了', 'Average time')} value={formatSeconds(report.avgMs, lang)} />
        </dl>
        {report.graded ? (
          <p className="mt-4 text-base leading-relaxed text-ink">
            {tx(
              `你得到 ${report.correct} 分。${report.answered} 題裡，答中 ${report.correct} 題。`,
              `You scored ${report.correct}. ${report.correct} of ${report.answered} checked lines matched the reference.`,
            )}
          </p>
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {report.answered === 0
              ? tx('這一場你還沒有留下選擇。', 'You have not left a choice this session.')
              : tx(
                  `你已選了 ${report.answered} 張。對照未齊，所以先不顯示分數。`,
                  `You have chosen ${report.answered} cards. The check is not complete, so there is no score yet.`,
                )}
          </p>
        )}
      </Panel>

      <Panel className="px-6 py-6">
        <h2 className="text-base font-medium">{tx('用時', 'Time spent')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {tx('最短係最有把握，最長係最猶豫。只描述呢一場用咗幾耐。', 'Shortest means most sure. Longest means most hesitant. This only describes time spent this session.')}
        </p>
        <TimeList title={tx('最有把握', 'Most sure')} empty={tx('未有作答時間。', 'No answer times yet.')} cards={report.sure} />
        <TimeList title={tx('最猶豫', 'Most hesitant')} empty={tx('未有作答時間。', 'No answer times yet.')} cards={report.hesitant} />
      </Panel>

      <Panel className="px-6 py-6">
        <h2 className="text-base font-medium">{tx('每一組用咗幾耐', 'Time by group')}</h2>
        {report.groups.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{tx('未有可以分組嘅選擇。', 'No choices to group yet.')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {report.groups.map((group) => (
              <li key={group.group} className="rounded-2xl bg-[#f7fbfe] px-4 py-3 text-sm text-ink">
                <span className="font-medium">{group.label}</span>
                <span className="mt-1 block text-muted">
                  {tx(
                    `${group.answered} 句 · 平均用了 ${formatSeconds(group.avgMs, lang)} · 與參考方向不同 ${group.wrong}`,
                    `${group.answered} lines · average ${formatSeconds(group.avgMs, lang)} · differed ${group.wrong}`,
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="px-6 py-6">
        <h2 className="text-base font-medium">{tx('要注意', 'Pause here')}</h2>
        {report.watch.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {report.graded
              ? tx('呢一場未有需要特別停低嘅一組。', 'No group needs a special pause this session.')
              : tx('對照未齊，所以未標要注意。', 'The check is not complete, so nothing is marked yet.')}
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {report.watch.map((group) => (
              <li key={group.group} className="rounded-2xl bg-blush px-4 py-3 text-sm leading-relaxed text-ink">
                <span className="font-medium">{tx('要注意', 'Pause here')} · {group.label}</span>
                <span className="mt-1 block">{group.suggestion}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="px-6 py-6">
        <h2 className="text-base font-medium">{tx('你較需要再停一停的地方', 'Lines to pause on')}</h2>
        {!report.graded ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {tx('對照未齊，所以未列出全部答錯嘅卡。', 'The check is not complete, so the full list of missed cards is not here yet.')}
          </p>
        ) : report.wrongCards.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {tx('呢一場已核對嘅選擇都同參考方向相近。', 'Every checked choice this session was close to the reference.')}
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {report.wrongCards.map((card) => (
              <li key={card.cardId} className="overflow-hidden rounded-2xl border border-line bg-white">
                <img src={card.imageSrc} alt={card.text} className="block w-full bg-white object-contain" />
                <div className="px-4 py-3">
                  <p className="text-sm text-muted">{tx(`第 ${card.number} 張`, `Card ${card.number}`)}</p>
                  <p className="mt-1 text-base text-ink">{card.text}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{card.why}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <details className="rounded-[28px] border border-line bg-white px-6 py-4">
        <summary className="cursor-pointer text-sm text-ink">{tx('每一張用咗幾耐', 'Time on each card')}</summary>
        {report.cards.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{tx('未有紀錄。', 'No record yet.')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {report.cards.map((card) => (
              <li key={card.cardId} className="text-sm leading-relaxed text-ink">
                {tx(`第 ${card.number} 張`, `Card ${card.number}`)} · {formatSeconds(card.ms, lang)}
                {card.mostSure ? tx(' · 最有把握', ' · most sure') : ''}
                {card.mostHesitant ? tx(' · 最猶豫', ' · most hesitant') : ''}
                <span className="mt-0.5 block text-muted">{card.text}</span>
              </li>
            ))}
          </ul>
        )}
      </details>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button className="flex-1" variant="outline" disabled={exporting != null} onClick={() => void save('png')}>
          {exporting === 'png' ? tx('正在下載', 'Saving') : tx('下載 PNG', 'Download PNG')}
        </Button>
        <Button className="flex-1" variant="outline" disabled={exporting != null} onClick={() => void save('jpeg')}>
          {exporting === 'jpeg' ? tx('正在下載', 'Saving') : tx('下載 JPG', 'Download JPG')}
        </Button>
      </div>
      {exportError ? (
        <p className="text-sm text-ink" role="alert">
          {exportError}
        </p>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f7fbfe] px-3 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="mt-1 text-lg text-ink">{value}</dd>
    </div>
  )
}

function TimeList({
  title,
  empty,
  cards,
}: {
  title: string
  empty: string
  cards: SessionReport['sure']
}) {
  const { lang, tx } = useLang()
  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      {cards.length === 0 ? (
        <p className="mt-1 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {cards.map((card) => (
            <li key={`${title}-${card.cardId}`} className="rounded-2xl bg-blush px-4 py-3 text-sm text-ink">
              {tx(`第 ${card.number} 張`, `Card ${card.number}`)} · {formatSeconds(card.ms, lang)}
              <span className="mt-1 block">{card.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
