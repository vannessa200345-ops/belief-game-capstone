import type { SelfPaceLink } from '@/domain/types'
import { useLang } from '@/i18n/lang'

export function SelfPaceNotice({ link }: { link: SelfPaceLink }) {
  const { tx } = useLang()
  if (link !== 'missing') return null
  return (
    <p className="text-sm leading-relaxed text-ink" role="status">
      {tx('伺服器答題未接上', 'The server is not ready for answering yet')}
      <span className="mt-1 block text-muted">
        {tx('仍可逐張選是或毫無道理。SQL 套用之後刷新，就會改走伺服器。', 'You can still choose Yes or No on each card. After the SQL is applied, refresh and it will use the server.')}
      </span>
    </p>
  )
}
