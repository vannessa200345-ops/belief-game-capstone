import { useLang } from '@/i18n/lang'

export function FreeNote() {
  const { tx } = useLang()
  return (
    <p className="text-sm leading-relaxed text-muted">
      {tx(
        '本活動免費參加，歡迎捐款支持。無需預先付款。',
        'This is free to join. Donations are welcome. Payment is not required first.',
      )}
    </p>
  )
}
