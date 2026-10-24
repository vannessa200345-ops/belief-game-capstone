import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

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
      {children}
    </div>
  )
}
