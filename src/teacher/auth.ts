import { bookingMessage } from '../booking/messages.ts'
import type { Fail } from '../booking/types.ts'
import { getSupabase } from '../lib/supabase.ts'

export type TeacherCallback = 'invite' | 'recovery' | 'callback' | 'none'

export function teacherRedirectUrl() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${window.location.origin}${base}/teacher`
}

let callbackOnce: Promise<TeacherCallback> | null = null

export function adoptTeacherCallback() {
  if (!callbackOnce) callbackOnce = readTeacherCallback()
  return callbackOnce
}

async function readTeacherCallback(): Promise<TeacherCallback> {
  const supabase = getSupabase()
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const accessToken = hash.get('access_token')
  const refreshToken = hash.get('refresh_token')
  const hashType = hash.get('type')
  if (!code && !(accessToken && refreshToken)) return 'none'

  if (code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(code)
    url.searchParams.delete('code')
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
    if (exchanged.error) throw exchanged.error
    return hashType === 'recovery' ? 'recovery' : 'callback'
  }

  const session = await supabase.auth.setSession({
    access_token: accessToken ?? '',
    refresh_token: refreshToken ?? '',
  })
  window.history.replaceState({}, '', `${url.pathname}${url.search}`)
  if (session.error) throw session.error
  if (hashType === 'recovery') return 'recovery'
  if (hashType === 'invite') return 'invite'
  return 'callback'
}

export async function signInWithTeacherPassword(email: string, password: string): Promise<{ ok: true } | Fail> {
  const supabase = getSupabase()
  const existing = await supabase.auth.getSession()
  if (existing.data.session?.user.is_anonymous) await supabase.auth.signOut()
  const signed = await supabase.auth.signInWithPassword({ email, password })
  if (signed.error) {
    const text = signed.error.message
    if (text.includes('Failed to fetch') || text.includes('NetworkError')) return { ok: false, error: bookingMessage('network') }
    return { ok: false, error: bookingMessage('sign_in_failed') }
  }
  return { ok: true }
}

export async function sendTeacherPasswordReset(email: string): Promise<{ ok: true } | Fail> {
  const supabase = getSupabase()
  const sent = await supabase.auth.resetPasswordForEmail(email, { redirectTo: teacherRedirectUrl() })
  if (sent.error) {
    const text = sent.error.message
    if (text.includes('Failed to fetch') || text.includes('NetworkError')) return { ok: false, error: bookingMessage('network') }
    return { ok: false, error: bookingMessage('unknown') }
  }
  return { ok: true }
}

export async function updateTeacherPassword(password: string): Promise<{ ok: true } | Fail> {
  const supabase = getSupabase()
  const updated = await supabase.auth.updateUser({ password })
  if (updated.error) {
    const text = updated.error.message
    if (text.includes('Failed to fetch') || text.includes('NetworkError')) return { ok: false, error: bookingMessage('network') }
    return { ok: false, error: bookingMessage('password_format') }
  }
  return { ok: true }
}
