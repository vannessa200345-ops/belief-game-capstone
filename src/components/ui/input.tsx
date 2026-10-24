import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'flex h-12 w-full rounded-2xl border border-line bg-white px-4 text-base text-ink outline-none placeholder:text-[#b7b0ba] focus-visible:ring-2 focus-visible:ring-lavender',
        className,
      )}
      {...props}
    />
  )
}
