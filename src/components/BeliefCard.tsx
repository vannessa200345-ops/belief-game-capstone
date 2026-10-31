import { useState } from 'react'
import { cn } from '@/lib/utils'

export function BeliefCard({
  theme,
  text,
  imageSrc,
  kicker,
  caption,
  compact = false,
}: {
  theme: string
  text: string
  imageSrc?: string
  kicker?: string
  caption?: string
  compact?: boolean
}) {
  const [broken, setBroken] = useState(false)
  const showImage = Boolean(imageSrc) && !broken

  return (
    <article className="overflow-hidden rounded-[28px] border border-line bg-white shadow-[0_18px_50px_rgba(42,36,48,0.045)]">
      <div className="h-1.5 bg-gradient-to-r from-pink via-lavender to-sky" aria-hidden="true" />
      <div className={cn(compact ? 'px-5 py-4' : 'px-6 py-5 sm:px-7')}>
        {kicker ? <p className="text-sm text-muted">{kicker}</p> : null}
        <p className={cn('text-sm tracking-wide text-muted', kicker && 'mt-3')}>{theme}</p>
      </div>
      {showImage ? (
        <>
          <img src={imageSrc} alt={text} className="block w-full bg-white object-contain" onError={() => setBroken(true)} />
          {caption ? <p className="px-6 py-4 text-base leading-relaxed text-ink">{caption}</p> : null}
        </>
      ) : (
        <div className={cn(compact ? 'px-5 pb-5' : 'px-6 pb-7 sm:px-7')}>
          <div className="h-px w-8 bg-gold" aria-hidden="true" />
          <p
            className={cn(
              'font-medium leading-relaxed text-ink',
              compact ? 'mt-4 text-xl' : 'mt-6 text-[1.65rem] leading-[1.55]',
            )}
          >
            {text}
          </p>
        </div>
      )}
    </article>
  )
}
