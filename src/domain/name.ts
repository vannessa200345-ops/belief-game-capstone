import { tx } from '../i18n/text.ts'

export function parseDisplayName(
  name: string,
): { ok: true; name: string } | { ok: false; error: string } {
  const cleaned = name.trim()
  if (!cleaned) return { ok: false, error: tx('請留下名字，主持才認得你。', 'Add a name so the host knows who you are.') }
  if (cleaned.length > 32) return { ok: false, error: tx('名字請保持在三十二個字以內。', 'Keep the name within 32 characters.') }
  for (const char of cleaned) {
    const code = char.charCodeAt(0)
    if (code <= 31 || code === 127) return { ok: false, error: tx('名字裡不要有控制字元。', 'Do not use control characters in the name.') }
  }
  return { ok: true, name: cleaned }
}
