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
  width?: 'player' | 'host'
}) {
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
