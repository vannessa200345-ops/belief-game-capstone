import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { useGame } from '@/api/useGame'
import { BrandMark } from '@/components/BrandMark'
import { SelfPaceNotice } from '@/components/SelfPaceNotice'
import { Frame } from '@/components/Frame'
import { Panel } from '@/components/Panel'
import { NoticeEmailField } from '@/components/NoticeEmailField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DECKS, deckMeta } from '@/domain/cards'
import { ROOM_CAPACITY, ROOM_IDEAL } from '@/domain/constants'
import { phaseLabel } from '@/domain/format'
import type { DeckId } from '@/domain/types'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/lib/title'

export function HostLobbyPage() {
  const state = useGame()
  const navigate = useNavigate()
  const deck = deckMeta(state.room.deck)
  const [openNew, setOpenNew] = useState(false)
  const [nextDeck, setNextDeck] = useState<DeckId>(state.room.deck)
  const [pending, setPending] = useState<'start' | 'create' | 'copy' | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [hostName, setHostName] = useState('')
  const [hostEmail, setHostEmail] = useState('')
  usePageTitle('信念遊戲 · 開場')

  const real = state.players.filter((player) => !player.demo).length
  const demos = state.players.length - real
  const recent = [...state.players].sort((a, b) => b.joinedAt - a.joinedAt).slice(0, 4)
  const hasRoom = state.room.code.length > 0
  const inLobby = state.room.phase === 'lobby'

  const sharePath = hasRoom ? `/r/${state.room.code}` : ''
  const shareUrl = sharePath ? `${window.location.origin}${sharePath}` : ''

  async function copyLink() {
    if (!shareUrl) return
    setPending('copy')
    setCopyError(false)
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopiedLink(true)
      window.setTimeout(() => setCopiedLink(false), 1600)
    } catch {
      setCopyError(true)
    }
    setPending(null)
  }

  async function copyCode() {
    setPending('copy')
    setCopyError(false)
    try {
      await navigator.clipboard.writeText(state.room.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopyError(true)
    }
    setPending(null)
  }

  async function start() {
    setPending('start')
    setActionError(null)
    const result = await api.startRoom()
    setPending(null)
    if (!result.ok) {
      setActionError(result.error)
      return
    }
    navigate('/host/control')
  }

  async function create() {
    setPending('create')
    setActionError(null)
    const result = await api.createRoom({ deck: nextDeck, name: hostName, email: hostEmail })
    setPending(null)
    if (!result.ok) {
      setActionError(result.error)
      return
    }
    setOpenNew(false)
  }

  return (
    <Frame width="host">
      <main id="main">
        <div className="flex items-start justify-between gap-4">
          <BrandMark kicker="Host" />
          <Link
            to="/"
            className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
          >
            學員入口
          </Link>
        </div>

        <h1 className="mt-10 text-[1.85rem] font-medium leading-snug">開一場安靜的房間</h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
          把房間碼交給學員。視像仍用 Zoom 或 Meet，這裡只看卡、作答和發言順序。
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Panel className="px-6 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted">房間碼</p>
                <p
                  className={cn(
                    'mt-1 text-ink',
                    hasRoom
                      ? 'font-latin text-3xl tracking-[0.18em] sm:text-5xl'
                      : 'text-2xl tracking-normal',
                  )}
                >
                  {hasRoom ? state.room.code : '尚未開出'}
                </p>
              </div>
              <p className="rounded-full bg-blush px-3 py-1 text-sm text-ink">{phaseLabel(state.room.phase)}</p>
            </div>
            <p className="mt-4 text-sm text-muted">
              {deck.name} · {deck.note}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => void copyCode()} disabled={pending != null || !hasRoom}>
                {copied ? '已複製' : '複製房間碼'}
              </Button>
              <Button variant="outline" onClick={() => void copyLink()} disabled={pending != null || !hasRoom}>
                {copiedLink ? '已複製連結' : '複製加入連結'}
              </Button>
              {hasRoom && inLobby ? (
                <Button onClick={() => void start()} disabled={pending != null}>
                  {pending === 'start' ? '正在開始' : '開始自速'}
                </Button>
              ) : null}
              {hasRoom && !inLobby ? (
                <Button asChild>
                  <Link to="/host/control">回到主持台</Link>
                </Button>
              ) : null}
            </div>
            {copyError ? <p className="mt-3 text-sm text-muted">複製未成功，請手動選取房間碼。</p> : null}
            {actionError ? (
              <p className="mt-3 text-sm text-ink" role="alert">
                {actionError}
              </p>
            ) : null}
            <div className="mt-3">
              <SelfPaceNotice link={state.selfPaceLink} />
            </div>
            {hasRoom ? (
              <p className="mt-4 break-all text-sm leading-relaxed text-ink">
                學員連結
                <span className="mt-1 block font-latin tracking-wide">{shareUrl}</span>
                <span className="mt-1 block text-muted">短路徑 {sharePath}</span>
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted">開出房間之後，這裡會出現 /r/房間碼。</p>
            )}
          </Panel>

          <Panel className="px-6 py-6">
            <h2 className="text-base font-medium">在場摘要</h2>
            <p className="mt-3 font-medium text-ink">
              {state.players.length}
              <span className="ml-1 text-sm font-normal text-muted">人在房</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {demos > 0
                ? `示範學員 ${demos} 人，真實進入 ${real} 人。理想約 ${ROOM_IDEAL} 人，上限 ${ROOM_CAPACITY} 人。`
                : `理想約 ${ROOM_IDEAL} 人，上限 ${ROOM_CAPACITY} 人。`}
            </p>
            <div className="mt-5 h-px w-8 bg-gold" aria-hidden="true" />
            <p className="mt-4 text-sm text-muted">最近加入</p>
            <ul className="mt-2 space-y-1 text-sm text-ink">
              {recent.map((player) => (
                <li key={player.id}>
                  {player.name}
                  {player.demo ? <span className="text-muted"> · 示範</span> : null}
                  {!player.connected ? <span className="text-muted"> · 未連上</span> : null}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              其餘 {Math.max(0, state.players.length - recent.length)} 人以人數計，不在開場頁逐一展開。
            </p>
          </Panel>
        </div>

        <div className="mt-6">
          {hasRoom ? (
            <Button variant="ghost" onClick={() => setOpenNew((open) => !open)}>
              {openNew ? '收起' : '另開一場'}
            </Button>
          ) : null}
          {!hasRoom || openNew ? (
            <Panel className="mt-3 px-6 py-6">
              <p className="text-sm leading-relaxed text-muted">
                {hasRoom
                  ? '開新場會結束現在這間房。學員要用新的房間碼再進入。'
                  : '選一套句子，再開出房間碼。學員用這個碼進來。'}
              </p>
              <label className="mt-4 block">
                <span className="text-sm text-ink">你的名字</span>
                <Input
                  className="mt-2"
                  value={hostName}
                  onChange={(event) => setHostName(event.target.value)}
                  autoComplete="name"
                  maxLength={32}
                  placeholder="主持怎樣稱呼"
                />
              </label>
              <div className="mt-4">
                <NoticeEmailField id="host-email" value={hostEmail} onChange={setHostEmail} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {DECKS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={nextDeck === item.id}
                    onClick={() => setNextDeck(item.id)}
                    className={cn(
                      'rounded-[22px] border px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender',
                      nextDeck === item.id ? 'border-pink bg-blush' : 'border-line bg-white',
                    )}
                  >
                    <span className="block text-[15px] text-ink">{item.name}</span>
                    <span className="mt-1 block text-sm text-muted">{item.note}</span>
                  </button>
                ))}
              </div>
              <Button className="mt-4" onClick={() => void create()} disabled={pending != null}>
                {pending === 'create' ? '正在開場' : hasRoom ? '確認開新場' : '開出房間碼'}
              </Button>
            </Panel>
          ) : null}
        </div>
      </main>
    </Frame>
  )
}
