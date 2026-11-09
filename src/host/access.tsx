import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { HostScope } from '@/booking/types'

export interface HostSession {
  scope: HostScope
  roomCode: string | null
  proofPin: string
}

interface HostAccessValue {
  session: HostSession | null
  unlock: (session: HostSession) => void
  lock: () => void
}

const HostAccessContext = createContext<HostAccessValue | null>(null)

export function HostAccessProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<HostSession | null>(null)
  const value = useMemo<HostAccessValue>(
    () => ({
      session,
      unlock: (next) => setSession(next),
      lock: () => setSession(null),
    }),
    [session],
  )
  return <HostAccessContext.Provider value={value}>{children}</HostAccessContext.Provider>
}

export function useHostAccess() {
  const value = useContext(HostAccessContext)
  if (!value) throw new Error('Host access is missing')
  return value
}
