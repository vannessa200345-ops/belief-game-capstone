import type { BeliefApi } from './contract.ts'
import { liveBackend } from '../lib/env.ts'

/** 有 anon env 就走 live Supabase；沒有就留在本地 mock，方便離線看畫面。 */
export const api: BeliefApi = liveBackend
  ? (await import('./supabase.ts')).supabaseApi
  : (await import('./mock.ts')).mockApi

export type { BeliefApi } from './contract.ts'
