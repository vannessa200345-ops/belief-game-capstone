import { Link } from 'react-router-dom'
import { PublicNav } from '@/components/PublicNav'
import { Frame } from '@/components/Frame'
import { useLang } from '@/i18n/lang'
import { usePageTitle } from '@/lib/title'

export function AboutPage() {
  const { tx } = useLang()
  usePageTitle(tx('信念遊戲 · 關於', 'Belief Game · About'))

  return (
    <>
      <PublicNav />
      <Frame width="host">
        <main id="main" className="max-w-2xl pb-16">
          <p className="text-sm text-muted">{tx('關於', 'About')}</p>
          <h1 className="mt-2 text-[1.85rem] font-medium leading-snug">{tx('用卡片，看清楚自己的信念', 'Use cards to see your beliefs clearly')}</h1>
          <p className="mt-6 text-base leading-relaxed text-ink">
            {tx(
              '信念遊戲是一間安靜的房間。每一張卡片是一句信念。參加者選擇「是」或「毫無道理」，從而看見自己平時未必說清楚的想法。',
              'Belief Game is a quiet room. Each card is one belief. Participants choose Yes or No, and see thoughts they may not usually say plainly.',
            )}
          </p>
          <p className="mt-4 text-base leading-relaxed text-muted">
            {tx(
              '視像仍可使用 Zoom 或 Meet。這裡負責卡片、選擇與文字。此頁是品牌介紹，不是進入房間。',
              'Video can stay on Zoom or Meet. This room is for cards, choices, and text. This page introduces the brand. It is not the way into a live room.',
            )}
          </p>
          <p className="mt-8 flex flex-wrap gap-4 text-sm">
            <Link to="/courses" className="text-ink underline decoration-line underline-offset-4">
              {tx('查看課程／場次', 'See courses and sessions')}
            </Link>
            <Link to="/" className="text-muted underline decoration-line underline-offset-4">
              {tx('進入房間', 'Enter a room')}
            </Link>
          </p>
        </main>
      </Frame>
    </>
  )
}
