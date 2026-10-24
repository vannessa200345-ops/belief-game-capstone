import { useSyncExternalStore } from 'react'
import { liveBackend } from '../lib/env.ts'

const store = liveBackend ? await import('../live/store.ts') : await import('../store/gameStore.ts')

export function useGame() {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
