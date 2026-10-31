export type Lang = 'zh' | 'en'

export const LANG_KEY = 'belief-lang'

export function currentLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

export function tx(zh: string, en: string, lang: Lang = currentLang()): string {
  return lang === 'en' ? en : zh
}
