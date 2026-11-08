import { Link, useLocation } from 'react-router-dom'
import { BrandMark } from '@/components/BrandMark'
import { useLang } from '@/i18n/lang'
import { cn } from '@/lib/utils'

export function PublicNav({ tone = 'site' }: { tone?: 'site' | 'slim' }) {
  const { tx } = useLang()
  const { pathname } = useLocation()
  const enter = pathname === '/' || pathname.startsWith('/r/')
  const items = [
    { to: '/about', label: tx('關於', 'About'), active: pathname.startsWith('/about') },
    { to: '/courses', label: tx('課程／場次', 'Courses'), active: pathname.startsWith('/courses') },
    { to: '/book', label: tx('預約', 'Book'), active: pathname.startsWith('/book') },
    { to: '/', label: tx('進入房間', 'Enter room'), active: enter },
  ]

  return (
    <header className={cn('border-b border-line bg-white/75', tone === 'slim' ? 'py-2' : 'py-3.5')}>
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 sm:px-8">
        <Link to="/about" className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender">
          <BrandMark singleLine={tone === 'slim'} />
        </Link>
        <nav aria-label={tx('網站', 'Site')} className="flex flex-wrap items-center gap-1">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm',
                item.active ? 'bg-blush text-ink' : 'text-muted hover:text-ink',
                tone === 'slim' ? 'px-2.5 py-1' : '',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
