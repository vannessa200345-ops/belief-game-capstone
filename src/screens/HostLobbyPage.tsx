import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { useGame } from '@/api/useGame'
import { BrandMark } from '@/components/BrandMark'
import { SelfPaceNotice } from '@/components/SelfPaceNotice'
import { Frame } from '@/components/Frame'
import { NextStep } from '@/components/NextStep'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DECKS, deckMeta } from '@/domain/cards'
import { ROOM_CAPACITY, ROOM_IDEAL } from '@/domain/constants'
import { phaseLabel } from '@/domain/format'
import type { DeckId } from '@/domain/types'
import { useLang } from '@/i18n/lang'
import { withBase } from '@/lib/base'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/lib/title'

export function HostLobbyPage() {
  const state = useGame()
  const { lang, tx } = useLang()
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
  usePageTitle(tx('信念遊戲 · 開場', 'Belief Game · Open a room'))

  const real = state.players.filter((player) => !player.demo).length
  const demos = state.players.length - real
  const recent = [...state.players].sort((a, b) => b.joinedAt - a.joinedAt).slice(0, 4)
  const hasRoom = state.room.code.length > 0
  const inLobby = state.room.phase === 'lobby'

  const sharePath = hasRoom ? withBase(`/r/${state.room.code}`) : ''
  const shareUrl = sharePath ? `${window.location.origin}${sharePath}` : ''
  const deckName = lang === 'en' ? deck.nameEn : deck.name
  const deckNote = lang === 'en' ? deck.noteEn : deck.note

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
    const result = await api.createRoom({ deck: nextDeck, name: hostName })
    setPending(null)
    if (!result.ok) {
      setActionError(result.error)
      return
    }
    setOpenNew(false)
  }

  const nextCopy = !hasRoom
    ? tx('揀一套牌，撳「開出房間碼」。', 'pick a deck, then press Open a room code.')
    : inLobby
      ? tx('複製加入連結俾學員，等佢哋入房，然後撳「開始答題」。', 'copy the join link for learners, then press Start answering.')
      : tx('撳「回到主持台」睇進度。', 'press Back to the console to see progress.')

  return (
    <Frame width="host">
      <main id="main">
        <div className="flex items-start justify-between gap-4">
          <BrandMark kicker="Host" />
          <Link to="/" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
            {tx('學員入口', 'Student entrance')}
          </Link>
        </div>

        <h1 className="mt-10 text-[1.85rem] font-medium leading-snug">{tx('開一場安靜的房間', 'Open a quiet room')}</h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
          {tx(
            '把房間連結交給學員。視像仍用 Zoom 或 Meet，這裡只看卡、作答和文字。',
            'Give learners the room link. Keep video on Zoom or Meet. This room is for cards, choices, and text.',
          )}
        </p>
        <div className="mt-4 max-w-xl">
          <NextStep label={tx('下一步：', 'Next: ')}>{nextCopy}</NextStep>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Panel className="px-6 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted">{tx('房間碼', 'Room code')}</p>
                <p
                  className={cn(
                    'mt-1 text-ink',
                    hasRoom ? 'font-latin text-3xl tracking-[0.18em] sm:text-5xl' : 'text-2xl tracking-normal',
                  )}
                >
                  {hasRoom ? state.room.code : tx('尚未開出', 'Not opened yet')}
                </p>
              </div>
              <p className="rounded-full bg-blush px-3 py-1 text-sm text-ink">{phaseLabel(state.room.phase, lang)}</p>
            </div>
            <p className="mt-4 text-sm text-muted">
              {deckName} · {deckNote}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => void copyCode()} disabled={pending != null || !hasRoom}>
                {copied ? tx('已複製', 'Copied') : tx('複製房間碼', 'Copy room code')}
              </Button>
              <Button variant="outline" onClick={() => void copyLink()} disabled={pending != null || !hasRoom}>
                {copiedLink ? tx('已複製連結', 'Link copied') : tx('複製加入連結', 'Copy join link')}
              </Button>
              {hasRoom && inLobby ? (
                <Button onClick={() => void start()} disabled={pending != null}>
                  {pending === 'start' ? tx('正在開始', 'Starting') : tx('開始答題', 'Start answering')}
                </Button>
              ) : null}
              {hasRoom && !inLobby ? (
                <Button asChild>
                  <Link to="/host/control">{tx('回到主持台', 'Back to the console')}</Link>
                </Button>
              ) : null}
            </div>
            {copyError ? (
              <p className="mt-3 text-sm text-muted">{tx('複製未成功，請手動選取房間碼。', 'Copy did not work. Select the room code yourself.')}</p>
            ) : null}
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
                {tx('學員連結', 'Learner link')}
                <span className="mt-1 block font-latin tracking-wide">{shareUrl}</span>
                <span className="mt-1 block text-muted">{tx('短路徑', 'Short path')} {sharePath}</span>
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted">{tx('開出房間之後，這裡會出現加入連結。', 'The join link appears after you open a room.')}</p>
            )}
          </Panel>

          <Panel className="px-6 py-6">
            <h2 className="text-base font-medium">{tx('在場摘要', 'Who is here')}</h2>
            <p className="mt-3 font-medium text-ink">
              {state.players.length}
              <span className="ml-1 text-sm font-normal text-muted">{tx('人在房', 'in the room')}</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {demos > 0
                ? tx(
                    `示範學員 ${demos} 人，真實進入 ${real} 人。理想約 ${ROOM_IDEAL} 人，上限 ${ROOM_CAPACITY} 人。`,
                    `${demos} demo learners, ${real} real. Ideal about ${ROOM_IDEAL}, maximum ${ROOM_CAPACITY}.`,
                  )
                : tx(`理想約 ${ROOM_IDEAL} 人，上限 ${ROOM_CAPACITY} 人。`, `Ideal about ${ROOM_IDEAL}, maximum ${ROOM_CAPACITY}.`)}
            </p>
            <div className="mt-5 h-px w-8 bg-gold" aria-hidden="true" />
            <p className="mt-4 text-sm text-muted">{tx('最近加入', 'Joined recently')}</p>
            <ul className="mt-2 space-y-1 text-sm text-ink">
              {recent.map((player) => (
                <li key={player.id}>
                  {player.name}
                  {player.demo ? <span className="text-muted"> · {tx('示範', 'demo')}</span> : null}
                  {!player.connected ? <span className="text-muted"> · {tx('未連上', 'not connected')}</span> : null}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              {tx(
                `其餘 ${Math.max(0, state.players.length - recent.length)} 人以人數計，不在開場頁逐一展開。`,
                `${Math.max(0, state.players.length - recent.length)} more people are counted, not listed here.`,
              )}
            </p>
          </Panel>
        </div>

        <div className="mt-6">
          {hasRoom ? (
            <Button variant="ghost" onClick={() => setOpenNew((open) => !open)}>
              {openNew ? tx('收起', 'Hide') : tx('另開一場', 'Open another room')}
            </Button>
          ) : null}
          {!hasRoom || openNew ? (
            <Panel className="mt-3 px-6 py-6">
              <p className="text-sm leading-relaxed text-muted">
                {hasRoom
                  ? tx('開新場會結束現在這間房。學員要用新的房間碼再進入。新一場會再打亂卡序。', 'A new room ends this one. Learners need the new code. Card order is shuffled again.')
                  : tx('選一套句子，再開出房間碼。學員用連結進來。', 'Pick a deck, then open a room code. Learners join with the link.')}
              </p>
              <label className="mt-4 block">
                <span className="text-sm text-ink">{tx('你的名字', 'Your name')}</span>
                <Input
                  className="mt-2"
                  value={hostName}
                  onChange={(event) => setHostName(event.target.value)}
                  autoComplete="name"
                  maxLength={32}
                  placeholder={tx('主持怎樣稱呼', 'What should we call the host')}
                />
              </label>
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
                    <span className="block text-[15px] text-ink">{lang === 'en' ? item.nameEn : item.name}</span>
                    <span className="mt-1 block text-sm text-muted">{lang === 'en' ? item.noteEn : item.note}</span>
                  </button>
                ))}
              </div>
              <Button className="mt-4" onClick={() => void create()} disabled={pending != null}>
                {pending === 'create' ? tx('正在開場', 'Opening') : hasRoom ? tx('確認開新場', 'Open the new room') : tx('開出房間碼', 'Open a room code')}
              </Button>
            </Panel>
          ) : null}
        </div>
      </main>
    </Frame>
  )
}
