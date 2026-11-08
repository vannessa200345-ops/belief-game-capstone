import { Link } from 'react-router-dom'
import { AndyPublicFacts } from '@/components/AndyPublicFacts'
import { PublicNav } from '@/components/PublicNav'
import { Frame } from '@/components/Frame'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { ROOM_CAPACITY } from '@/domain/constants'
import { useLang } from '@/i18n/lang'
import { usePageTitle } from '@/lib/title'

export function CoursesPage() {
  const { tx } = useLang()
  usePageTitle(tx('信念遊戲 · 課程／場次', 'Belief Game · Courses'))

  return (
    <>
      <PublicNav />
      <Frame width="host">
        <main id="main" className="pb-16">
          <p className="text-sm text-muted">{tx('課程／場次', 'Courses')}</p>
          <h1 className="mt-2 max-w-2xl text-[1.85rem] font-medium leading-snug">
            {tx('兩種參加方式', 'Two ways to take part')}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            {tx(
              '可以先參加小組場次，也可以另外預約一對一。登記在預約頁完成。進入進行中的房間，仍使用房間碼。',
              'You can join a group session, or book a one-on-one separately. Registration is on the booking page. A live room still uses a room code.',
            )}
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <Panel className="px-6 py-8">
              <p className="text-sm text-muted">{tx('小組場次', 'Group session')}</p>
              <p className="mt-3 text-3xl text-ink">{tx('隨緣樂助', 'Give as you wish')}</p>
              <p className="mt-4 text-sm leading-relaxed text-ink">
                {tx('無需預先付款。金額由你決定，不是預購門票。', 'No advance payment. The amount is yours to decide. This is not a prepaid ticket.')}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {tx(
                  `人數上限由主持設定，目前不多於 ${ROOM_CAPACITY} 人。`,
                  `The host sets the limit. For now it is no more than ${ROOM_CAPACITY} people.`,
                )}
              </p>
            </Panel>
            <Panel className="px-6 py-8">
              <p className="text-sm text-muted">{tx('一對一', 'One-on-one')}</p>
              <p className="mt-3 font-latin text-3xl text-ink">HKD 800</p>
              <p className="mt-4 text-sm leading-relaxed text-ink">
                {tx('約一小時，費用 HKD 800。此處只作登記，不在此收款。', 'About one hour, HKD 800. This site only registers the time. Payment is not collected here.')}
              </p>
              <div className="mt-6 border-t border-line pt-5">
                <p className="text-base text-ink">Andy</p>
                <p className="mt-1 text-sm text-muted">{tx('希塔療癒。現時可預約。', 'Theta Healing. Available now.')}</p>
                <div className="mt-4">
                  <AndyPublicFacts />
                </div>
              </div>
            </Panel>
          </div>
          <Button className="mt-10" size="lg" asChild>
            <Link to="/book">{tx('前往預約', 'Go to booking')}</Link>
          </Button>
        </main>
      </Frame>
    </>
  )
}
