import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LANG_KEY, tx as pick, type Lang } from './text.ts'

const LangContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void } | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => currentFromStore())

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(LANG_KEY, next)
    } catch {
      /* 這一頁仍然可以轉語言。 */
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant'
  }, [lang])

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

function currentFromStore(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

export function useLang() {
  const ctx = useContext(LangContext)
  const lang = ctx?.lang ?? 'zh'
  const setLang = ctx?.setLang ?? (() => undefined)
  return {
    lang,
    setLang,
    tx: (zh: string, en: string) => pick(zh, en, lang),
  }
}
