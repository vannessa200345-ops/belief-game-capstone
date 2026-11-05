import { useLang } from '@/i18n/lang'

export function BrandMark({
  kicker = 'Belief Game',
  singleLine = false,
}: {
  kicker?: string
  singleLine?: boolean
}) {
  const { tx } = useLang()
  const title = tx('信念遊戲', 'Belief Game')
  return (
    <div className="flex items-center gap-3">
      <span className="flex shrink-0 gap-1.5" aria-hidden="true">
        <span className="size-2 rounded-full bg-pink" />
        <span className="size-2 rounded-full bg-lavender" />
        <span className="size-2 rounded-full bg-sky" />
        <span className="size-2 rounded-full bg-mint" />
      </span>
      {singleLine ? (
        <span className="whitespace-nowrap text-[15px] tracking-[0.18em] text-ink">{title}</span>
      ) : (
        <span className="leading-tight">
          <span className="block text-[15px] tracking-[0.22em] text-ink">{title}</span>
          <span className="mt-0.5 block font-latin text-[11px] font-light tracking-[0.22em] text-gold">
            {kicker}
          </span>
        </span>
      )}
    </div>
  )
}
