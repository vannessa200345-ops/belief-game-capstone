import type { SelfPaceLink } from '@/domain/types'

export function SelfPaceNotice({ link }: { link: SelfPaceLink }) {
  if (link !== 'missing') return null
  return (
    <p className="text-sm leading-relaxed text-ink" role="status">
      後端自速未上線
      <span className="mt-1 block text-muted">仍可逐張選是或毫無道理。SQL 套用之後刷新，就會改走伺服器。</span>
    </p>
  )
}
