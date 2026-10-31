import type { ReactNode } from 'react'
import { useGame } from '@/api/useGame'
import { LanguageToggle } from './Frame'
import { useLang } from '@/i18n/lang'
import { BrandMark } from './BrandMark'

function QuietDots() {
  return (
    <span className="flex gap-2" aria-hidden="true">
      <span className="belief-dot size-2 rounded-full bg-pink" />
      <span className="belief-dot size-2 rounded-full bg-lavender [animation-delay:180ms]" />
      <span className="belief-dot size-2 rounded-full bg-sky [animation-delay:360ms]" />
      <span className="belief-dot size-2 rounded-full bg-mint [animation-delay:540ms]" />
    </span>
  )
}

export function LoadingScreen() {
  const { tx } = useLang()
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>
        <div className="flex justify-center">
          <BrandMark />
        </div>
        <div className="mt-10 flex justify-center">
          <QuietDots />
        </div>
        <p className="mt-6 text-lg text-ink">{tx('正在連上', 'Connecting')}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{tx('房間還在，慢慢來就好。', 'The room is still here. Take your time.')}</p>
      </div>
    </div>
  )
}

export function ReconnectBanner() {
  const { tx } = useLang()
  return (
    <div className="border-b border-line bg-blush/90 px-5 py-3 text-center text-sm text-ink" role="status">
      {tx('連線頓了一下，正在重新接上。已選的答案還在。', 'The connection paused. Rejoining now. Choices already made are still here.')}
    </div>
  )
}

export function ConnectionGate({ children }: { children: ReactNode }) {
  const state = useGame()
  const params = new URLSearchParams(window.location.search)
  if (params.get('loading') === '1') return <LoadingScreen />
  const pinned = params.get('reconnect') === '1'
  if (state.connection === 'connecting') return <LoadingScreen />
  return (
    <>
      {pinned || state.connection === 'reconnecting' ? <ReconnectBanner /> : null}
      {children}
    </>
  )
}
