import type { ReactNode } from 'react'
import { useLang } from '@/i18n/lang'
import { cn } from '@/lib/utils'

export function LanguageToggle() {
  const { lang, setLang, tx } = useLang()
  return (
    <div className="mb-4 flex justify-end">
      <div
        className="inline-flex rounded-full border border-line bg-white p-1 text-sm"
        role="group"
        aria-label={tx('語言', 'Language')}
      >
        <button
          type="button"
          aria-pressed={lang === 'zh'}
          onClick={() => setLang('zh')}
          className={cn(
            'rounded-full px-3 py-1',
            lang === 'zh' ? 'bg-ink text-white' : 'text-muted hover:text-ink',
          )}
        >
          中文
        </button>
        <button
          type="button"
          aria-pressed={lang === 'en'}
          onClick={() => setLang('en')}
          className={cn(
            'rounded-full px-3 py-1 font-latin',
            lang === 'en' ? 'bg-ink text-white' : 'text-muted hover:text-ink',
          )}
        >
          EN
        </button>
      </div>
    </div>
  )
}

export function Frame({
  children,
  width = 'player',
}: {
  children: ReactNode
  width?: 'player' | 'host' | 'entry'
}) {
  if (width === 'entry') {
    return (
      <div className="relative mx-auto box-border min-h-dvh w-full max-w-[480px] px-5 py-6 md:max-w-[1120px] md:px-10 md:py-14">
        <div
          className="pointer-events-none absolute left-6 top-24 hidden h-56 w-56 rounded-full bg-[rgba(248,187,208,0.55)] blur-3xl md:block"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-8 bottom-20 hidden h-64 w-64 rounded-full bg-[rgba(225,190,231,0.5)] blur-3xl md:block"
          aria-hidden="true"
        />
        <div className="relative md:mx-auto md:max-w-[42rem] md:rounded-[28px] md:border md:border-line md:bg-white/80 md:px-12 md:py-10 md:shadow-[0_22px_50px_rgba(225,190,231,0.28)]">
          <LanguageToggle />
          {children}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'mx-auto box-border min-h-dvh px-5 py-6 sm:py-10',
        width === 'player' ? 'max-w-[480px]' : 'max-w-[1100px] sm:px-8',
      )}
    >
      <LanguageToggle />
      {children}
    </div>
  )
}
