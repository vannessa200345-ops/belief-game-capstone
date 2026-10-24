import { cn } from '@/lib/utils'

export function BeliefCard({
  theme,
  text,
  kicker,
  compact = false,
}: {
  theme: string
  text: string
  kicker?: string
  compact?: boolean
}) {
  return (
    <article className="overflow-hidden rounded-[28px] border border-line bg-white shadow-[0_18px_50px_rgba(42,36,48,0.045)]">
      <div className="h-1.5 bg-gradient-to-r from-pink via-lavender to-sky" aria-hidden="true" />
      <div className={cn(compact ? 'px-5 py-5' : 'px-6 py-7 sm:px-7')}>
        {kicker ? <p className="text-sm text-muted">{kicker}</p> : null}
        <p className={cn('text-sm tracking-wide text-muted', kicker && 'mt-3')}>{theme}</p>
        <div className="mt-3 h-px w-8 bg-gold" aria-hidden="true" />
        <p
          className={cn(
            'font-medium leading-relaxed text-ink',
            compact ? 'mt-4 text-xl' : 'mt-6 text-[1.65rem] leading-[1.55]',
          )}
        >
          {text}
        </p>
      </div>
    </article>
  )
}
