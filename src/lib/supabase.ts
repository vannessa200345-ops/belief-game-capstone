import { createClient, type SupabaseClient } from '@supabase/supabase-js'
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
        storage: window.sessionStorage,
      },
    })
  }
  return client
}

export async function ensureAnonymousSession() {
  const supabase = getSupabase()
  const existing = await supabase.auth.getSession()
  if (existing.data.session) return existing.data.session
  const signed = await supabase.auth.signInAnonymously()
  if (signed.error || !signed.data.session) {
    throw signed.error ?? new Error('未能建立匿名身份。')
  }
  return signed.data.session
}
