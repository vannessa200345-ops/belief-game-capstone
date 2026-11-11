import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { durableAuthStorage } from './durableKv.ts'
import { liveBackend, supabaseAnonKey, supabaseUrl } from './env.ts'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!liveBackend) {
    throw new Error('Supabase 尚未設定。')
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: durableAuthStorage(),
      },
    })
  }
  return client
}

let pendingSession: Promise<Session> | null = null

/** 同一輪只建立一個匿名身份。第二個身份會令仍有效的房間變成 not_member。 */
export function ensureAnonymousSession() {
  if (!pendingSession) {
    pendingSession = openAnonymousSession().finally(() => {
      pendingSession = null
    })
  }
  return pendingSession
}

async function openAnonymousSession() {
  const supabase = getSupabase()
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const existing = await supabase.auth.getSession()
    if (existing.data.session) return existing.data.session
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 0))
  }
  const signed = await supabase.auth.signInAnonymously()
  if (signed.error || !signed.data.session) {
    throw signed.error ?? new Error('未能建立匿名身份。')
  }
  return signed.data.session
}
