import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useGame } from '@/api/useGame'
import { bookingApi } from '@/booking/api'
import { defaultStartValue, formatWhen } from '@/booking/format'
import { bookingMessage } from '@/booking/messages'
import { BOOKING_SESSION_CAPACITY, parseHostLabel, parseHostPin, parseRoomCode, parseStartsAt } from '@/booking/rules'
import type { PublicSlot, SlotBooking } from '@/booking/types'
import { BrandMark } from '@/components/BrandMark'
import { FreeNote } from '@/components/FreeNote'
import { Frame } from '@/components/Frame'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useHostAccess } from '@/host/access'
import { useLang } from '@/i18n/lang'
import { withBase } from '@/lib/base'
import { usePageTitle } from '@/lib/title'

export function HostSchedulePage() {
  const { session, unlock } = useHostAccess()
  const state = useGame()
  const { lang, tx } = useLang()
  const [startsAt, setStartsAt] = useState(defaultStartValue)
  const [hostLabel, setHostLabel] = useState('')
  const [roomCode, setRoomCode] = useState(session?.roomCode ?? state.room.code)
  const [slots, setSlots] = useState<PublicSlot[]>([])
  const [claimToken, setClaimToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [directRoom, setDirectRoom] = useState(session?.roomCode ?? state.room.code)
  const [directPin, setDirectPin] = useState('')
  const [directMessage, setDirectMessage] = useState<string | null>(null)
  usePageTitle(tx('信念遊戲 · 場次安排', 'Belief Game · Schedule'))

  async function reload() {
    const result = await bookingApi.listBoard()
    if (!result.ok) {
      setError(result.error)
      return
    }
    setSlots(result.board.slots.filter((slot) => slot.kind === 'group'))
  }

  useEffect(() => {
    let active = true
    void bookingApi.listBoard().then((result) => {
      if (!active) return
      if (!result.ok) setError(result.error)
      else setSlots(result.board.slots.filter((slot) => slot.kind === 'group'))
    })
    return () => {
      active = false
    }
  }, [])

  if (!session) return null

  async function create(event: FormEvent) {
    event.preventDefault()
    if (!session) return
    const when = parseStartsAt(startsAt)
    const label = parseHostLabel(hostLabel)
    const code = parseRoomCode(roomCode)
    if (!when.ok) return setError(bookingMessage(when.error))
    if (!label.ok) return setError(bookingMessage(label.error))
    if (!code.ok) return setError(bookingMessage(code.error))
    setPending(true)
    setError(null)
    setClaimToken(null)
    const result = await bookingApi.createSlot({
      proofPin: session.proofPin,
      startsAt: when.iso,
      capacity: BOOKING_SESSION_CAPACITY,
      hostLabel: label.label,
      roomCode: code.code,
    })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setClaimToken(result.claimToken)
    await reload()
  }

  async function setDirect(event: FormEvent) {
    event.preventDefault()
    if (!session) return
    const code = parseRoomCode(directRoom)
    const pin = parseHostPin(directPin)
    if (!code.ok || !code.code) return setDirectMessage(bookingMessage('room_code'))
    if (!pin.ok) return setDirectMessage(bookingMessage(pin.error))
    setPending(true)
    setDirectMessage(null)
    const result = await bookingApi.setSessionPin({
      roomCode: code.code,
      newPin: pin.pin,
      proofPin: session.proofPin,
    })
    setPending(false)
    if (!result.ok) {
      setDirectMessage(result.error)
      return
    }
    if (session.scope !== 'operator') {
      unlock({ scope: 'session', roomCode: code.code, proofPin: pin.pin })
    }
    setDirectPin('')
    setDirectMessage(tx('本場密碼已更新。', 'This session’s password is updated.'))
  }

  return (
    <Frame width="host">
      <main id="main">
        <div className="flex items-start justify-between gap-4">
          <BrandMark kicker="Host" />
          <Link to="/host" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
            {tx('返回開場', 'Back to opening')}
          </Link>
        </div>
        <h1 className="mt-10 text-[1.85rem] font-medium leading-snug">{tx('安排小組場次', 'Schedule a group session')}</h1>
        <div className="mt-3 max-w-xl">
          <FreeNote />
        </div>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          {tx(
            '請設定日期與時間。有人登記之後，即可開出房間並開始。',
            'Set the date and time. Once people have registered, open the room and start.',
          )}
        </p>

        <Panel className="mt-6 px-6 py-6">
          <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={(event) => void create(event)}>
            <label className="block sm:col-span-2" htmlFor="slot-start">
              <span className="text-sm text-ink">{tx('日期與時間', 'Date and time')}</span>
              <Input id="slot-start" className="mt-2" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
            </label>
            <label className="block" htmlFor="slot-host">
              <span className="text-sm text-ink">{tx('主持名稱（可選）', 'Host name (optional)')}</span>
              <Input id="slot-host" className="mt-2" value={hostLabel} onChange={(event) => setHostLabel(event.target.value)} maxLength={32} />
            </label>
            <label className="block sm:col-span-2" htmlFor="slot-room">
              <span className="text-sm text-ink">{tx('房間碼（可選，稍後亦可補上）', 'Room code (optional, you can add it later)')}</span>
              <Input
                id="slot-room"
                className="mt-2 uppercase tracking-[0.14em]"
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={8}
              />
            </label>
            {state.room.code && state.room.code !== roomCode ? (
              <button type="button" className="text-left text-sm text-ink underline decoration-line underline-offset-4 sm:col-span-2" onClick={() => setRoomCode(state.room.code)}>
                {tx(`使用目前房間 ${state.room.code}`, `Use the current room ${state.room.code}`)}
              </button>
            ) : null}
            {error ? (
              <p className="text-sm text-ink sm:col-span-2" role="alert">
                {error}
              </p>
            ) : null}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? tx('正在開出', 'Opening') : tx('開出場次', 'Open a session')}
              </Button>
            </div>
          </form>
          {claimToken ? (
            <ClaimNotice token={claimToken} />
          ) : null}
        </Panel>

        <div className="mt-6 grid gap-4">
          {slots.length === 0 ? (
            <p className="text-sm text-muted">{tx('尚未開出場次。', 'No sessions yet.')}</p>
          ) : (
            slots.map((slot) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                proofPin={session.proofPin}
                currentRoomCode={state.room.code}
                lang={lang}
                onChanged={reload}
                onClaim={setClaimToken}
              />
            ))
          )}
        </div>

        <details className="mt-8 max-w-xl text-sm text-muted">
          <summary className="cursor-pointer text-ink underline decoration-line underline-offset-4">
            {tx('直接設定本場密碼', 'Set this session’s password directly')}
          </summary>
          <p className="mt-3 leading-relaxed">
            {tx(
              '平台營運者或本場主持可以在這裡更換六位數字密碼。租用場次的主持應使用領取碼自行設定。請勿把營運密碼交給對方。',
              'The platform operator, or the host of this session, can change the six-digit password here. A renter should set their own password with a claim code. Do not give them the operator password.',
            )}
          </p>
          <form className="mt-4 grid gap-3" noValidate onSubmit={(event) => void setDirect(event)}>
            <label className="block" htmlFor="direct-room">
              <span className="text-sm text-ink">{tx('房間碼', 'Room code')}</span>
              <Input
                id="direct-room"
                className="mt-2 uppercase tracking-[0.14em]"
                value={directRoom}
                onChange={(event) => setDirectRoom(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                maxLength={8}
                required
              />
            </label>
            <label className="block" htmlFor="direct-pin">
              <span className="text-sm text-ink">{tx('新的六位數字密碼', 'New six-digit password')}</span>
              <Input
                id="direct-pin"
                className="mt-2 tracking-[0.28em]"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={directPin}
                onChange={(event) => setDirectPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
              />
            </label>
            {directMessage ? <p className="text-sm text-ink">{directMessage}</p> : null}
            <Button type="submit" variant="outline" disabled={pending}>
              {tx('更新本場密碼', 'Update the session password')}
            </Button>
          </form>
        </details>
      </main>
    </Frame>
  )
}

function ClaimNotice({ token }: { token: string }) {
  const { tx } = useLang()
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  async function copy() {
    setFailed(false)
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setFailed(true)
    }
  }

  return (
    <div className="mt-5 rounded-2xl bg-blush px-4 py-4" role="status">
      <p className="text-sm leading-relaxed text-ink">
        {tx(
          '領取碼只顯示一次。請交給該場主持，讓其自行設定密碼。不要同時送出營運密碼。',
          'The claim code is shown once. Give it to that session’s host so they can set their own password. Do not send the operator password with it.',
        )}
      </p>
      <p className="mt-2 break-all font-latin tracking-wide text-ink">{token}</p>
      <Button className="mt-3" variant="outline" onClick={() => void copy()}>
        {copied ? tx('已複製', 'Copied') : tx('複製領取碼', 'Copy claim code')}
      </Button>
      {failed ? <p className="mt-2 text-sm text-muted">{tx('複製未成功，請手動選取領取碼。', 'Copy did not work. Select the claim code yourself.')}</p> : null}
      <p className="mt-3">
        <Link to="/host/setup" className="text-sm text-ink underline decoration-line underline-offset-4">
          {tx('打開設定密碼頁', 'Open the password setup page')}
        </Link>
      </p>
    </div>
  )
}

function SlotCard({
  slot,
  proofPin,
  currentRoomCode,
  lang,
  onChanged,
  onClaim,
}: {
  slot: PublicSlot
  proofPin: string
  currentRoomCode: string
  lang: 'zh' | 'en'
  onChanged: () => Promise<void>
  onClaim: (token: string) => void
}) {
  const { tx } = useLang()
  const [bookings, setBookings] = useState<SlotBooking[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const joinPath = slot.roomCode ? withBase(`/r/${slot.roomCode}`) : ''
  const status =
    slot.status === 'full'
      ? tx('這一場已經額滿', 'This session is already full')
      : slot.status === 'started'
        ? tx('已經開始', 'Started')
        : tx('接受登記', 'Open')

  async function showBookings() {
    setPending(true)
    setError(null)
    const result = await bookingApi.listBookings({ slotId: slot.id, proofPin, roomCode: slot.roomCode })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setBookings(result.bookings)
  }

  async function attach() {
    if (!currentRoomCode) return
    setPending(true)
    setError(null)
    const result = await bookingApi.attachRoom({ slotId: slot.id, roomCode: currentRoomCode, proofPin })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    await onChanged()
  }

  async function reissue() {
    setPending(true)
    setError(null)
    const result = await bookingApi.issueClaim({ slotId: slot.id, proofPin, roomCode: slot.roomCode })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onClaim(result.claimToken)
  }

  async function cancel() {
    setPending(true)
    setError(null)
    const result = await bookingApi.cancelSlot({ slotId: slot.id, proofPin, roomCode: slot.roomCode })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    await onChanged()
  }

  return (
    <Panel className="px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">{formatWhen(slot.startsAt, lang)}</h2>
          <p className="mt-1 text-sm text-muted">
            {slot.hostLabel ? `${slot.hostLabel} · ` : ''}
            {slot.bookedCount >= slot.capacity
              ? tx('這一場已經額滿', 'This session is already full')
              : tx(`已登記 ${slot.bookedCount} 人`, `${slot.bookedCount} registered`)}
            {' · '}
            {status}
          </p>
          {slot.roomCode ? (
            <p className="mt-2 break-all text-sm text-ink">
              {tx('加入連結', 'Join link')}
              <span className="mt-1 block font-latin">{`${window.location.origin}${joinPath}`}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">{tx('尚未連上房間碼。開出房間後可再補上。', 'No room code yet. Add it after you open a room.')}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!slot.roomCode && currentRoomCode ? (
            <Button variant="outline" disabled={pending} onClick={() => void attach()}>
              {tx(`寫入房間 ${currentRoomCode}`, `Attach room ${currentRoomCode}`)}
            </Button>
          ) : null}
          <Button variant="outline" disabled={pending} onClick={() => void showBookings()}>
            {tx('查看登記', 'View registrations')}
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => void reissue()}>
            {tx('重新產生領取碼', 'New claim code')}
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => void cancel()}>
            {tx('取消場次', 'Cancel session')}
          </Button>
        </div>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-ink" role="alert">
          {error}
        </p>
      ) : null}
      {bookings ? (
        bookings.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{tx('尚未有人登記。', 'Nobody has registered yet.')}</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-ink">
            {bookings.map((booking) => (
              <li key={`${booking.createdAt}-${booking.name}`}>
                {booking.name}
                {booking.contact ? <span className="text-muted"> · {booking.contact}</span> : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </Panel>
  )
}
