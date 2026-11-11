/** 同一部瀏覽器可以活過重新整理、分頁被系統收起、以及行程被殺掉。sessionStorage 唔可以。 */

export interface Kv {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function memoryKv(initial: Record<string, string> = {}): Kv {
  const data: Record<string, string> = { ...initial }
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null
    },
    setItem(key, value) {
      data[key] = value
    },
    removeItem(key) {
      delete data[key]
    },
  }
}

export function readDurable(local: Kv, session: Kv, key: string): string | null {
  try {
    const saved = local.getItem(key)
    if (saved != null) return saved
  } catch {
    /* 讀唔到 local 時再睇舊的 session。 */
  }
  let legacy: string | null = null
  try {
    legacy = session.getItem(key)
  } catch {
    return null
  }
  if (legacy == null) return null
  try {
    local.setItem(key, legacy)
    session.removeItem(key)
  } catch {
    /* 遷唔到就先用舊值。分頁被收起之後，session 會一併消失。 */
  }
  return legacy
}

export function writeDurable(local: Kv, session: Kv, key: string, value: string) {
  local.setItem(key, value)
  try {
    session.removeItem(key)
  } catch {
    /* local 已寫入。 */
  }
}

export function removeDurable(local: Kv, session: Kv, key: string) {
  try {
    local.removeItem(key)
  } catch {
    /* 下面仍會清 session。 */
  }
  try {
    session.removeItem(key)
  } catch {
    /* 私人模式可以繼續。 */
  }
}

function browserStore(kind: 'local' | 'session'): Kv {
  const storage = () => (kind === 'local' ? window.localStorage : window.sessionStorage)
  return {
    getItem(key) {
      try {
        return storage().getItem(key)
      } catch {
        return null
      }
    },
    setItem(key, value) {
      storage().setItem(key, value)
    },
    removeItem(key) {
      try {
        storage().removeItem(key)
      } catch {
        /* 清唔到就當冇呢一條。 */
      }
    },
  }
}

export function browserLocal(): Kv {
  return browserStore('local')
}

export function browserSession(): Kv {
  return browserStore('session')
}

/** Supabase 匿名身份要同房間寫入同一種儲存，否則新身份會被當成 not_member。 */
export function durableAuthStorage() {
  const local = browserLocal()
  const session = browserSession()
  return {
    getItem: (key: string) => readDurable(local, session, key),
    setItem: (key: string, value: string) => {
      try {
        writeDurable(local, session, key, value)
      } catch {
        try {
          session.setItem(key, value)
        } catch {
          /* 匿名身份留喺記憶體，這一頁仍可答。 */
        }
      }
    },
    removeItem: (key: string) => {
      removeDurable(local, session, key)
    },
  }
}
