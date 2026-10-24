import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        'rounded-[28px] border border-line bg-white shadow-[0_18px_50px_rgba(42,36,48,0.045)]',
        className,
      )}
      {...props}
    />
  )
}
