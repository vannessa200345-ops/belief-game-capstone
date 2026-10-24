export function parseDisplayName(
  name: string,
): { ok: true; name: string } | { ok: false; error: string } {
  const cleaned = name.trim()
  if (!cleaned) return { ok: false, error: '請留下名字，主持才認得你。' }
  if (cleaned.length > 32) return { ok: false, error: '名字請保持在三十二個字以內。' }
  for (const char of cleaned) {
    const code = char.charCodeAt(0)
    if (code <= 31 || code === 127) return { ok: false, error: '名字裡不要有控制字元。' }
  }
  return { ok: true, name: cleaned }
}
