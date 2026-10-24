function jwtRole(token: string): string | null {
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(padded)) as { role?: unknown }
    return typeof json.role === 'string' ? json.role : null
  } catch {
    return null
  }
}

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

/** 前端只可以帶 anon。service_role 即使寫進 env 也不會拿來連。 */
export const liveBackend = url.length > 0 && key.length > 0 && jwtRole(key) === 'anon'

export const supabaseUrl = url
export const supabaseAnonKey = liveBackend ? key : ''
