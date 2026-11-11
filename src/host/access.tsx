import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { HostScope } from '@/booking/types'
import { loadHostDeskBrowser, loadSurfaceBrowser, saveHostDeskBrowser, saveSurfaceBrowser } from '@/host/deskStore'

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
  const [session, setSession] = useState<HostSession | null>(() => loadHostDeskBrowser())
  const value = useMemo<HostAccessValue>(
    () => ({
      session,
      unlock: (next) => {
        try {
          saveHostDeskBrowser(next)
        } catch {
          /* 這一頁仍然解鎖。寫不入時，重新整理後要再輸入密碼。 */
        }
        setSession(next)
      },
      lock: () => {
        try {
          saveHostDeskBrowser(null)
          if (loadSurfaceBrowser()?.startsWith('/host')) saveSurfaceBrowser(null)
        } catch {
          /* 記憶體先鎖上。 */
        }
        setSession(null)
      },
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
