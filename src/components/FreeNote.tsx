import { useLang } from '@/i18n/lang'

export function FreeNote() {
  const { tx } = useLang()
  return (
    <p className="text-sm leading-relaxed text-muted">
      {tx(
        '本活動為隨緣樂助，無需預先付款。金額由你決定。',
        'This gathering is give as you wish. No advance payment is required. The amount is yours to decide.',
      )}
    </p>
  )
}
