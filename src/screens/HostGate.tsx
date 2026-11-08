import { useState, type FormEvent } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { bookingApi } from '@/booking/api'
import { parseHostPin, parseRoomCode } from '@/booking/rules'
import { bookingMessage } from '@/booking/messages'
import { BrandMark } from '@/components/BrandMark'
import { Frame } from '@/components/Frame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useHostAccess } from '@/host/access'
import { useLang } from '@/i18n/lang'
import { liveBackend } from '@/lib/env'
import { usePageTitle } from '@/lib/title'

export function HostGate() {
  const { session, lock } = useHostAccess()
  const { tx } = useLang()
  if (!session) return <HostPinPage />
  return (
    <>
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-4 gap-y-2 px-5 pt-4 text-sm sm:px-8">
        <Link to="/host" className="text-ink underline decoration-line underline-offset-4">
          {tx('開場', 'Open a room')}
        </Link>
        <Link to="/host/control" className="text-ink underline decoration-line underline-offset-4">
          {tx('主持台', 'Console')}
        </Link>
        <Link to="/host/analytics#live-tally" className="text-ink underline decoration-line underline-offset-4">
          {tx('現場計分', 'Live scoring')}
        </Link>
        <Link to="/host/schedule" className="text-ink underline decoration-line underline-offset-4">
          {tx('場次安排', 'Schedule')}
        </Link>
        <Link to="/book" className="text-muted underline decoration-line underline-offset-4">
          {tx('預約頁', 'Booking page')}
        </Link>
        <button type="button" className="text-muted underline decoration-line underline-offset-4" onClick={lock}>
          {tx('鎖定主持台', 'Lock the desk')}
        </button>
      </div>
      {session.scope === 'preview' ? (
        <p className="mx-auto max-w-[1100px] px-5 pt-3 text-sm leading-relaxed text-muted sm:px-8">
          {tx(
            '目前是本地預覽，尚未連接資料庫。正式場次會在伺服器核對密碼。',
            'This is a local preview, with no database connected. Live sessions check the password on the server.',
          )}
        </p>
      ) : null}
      <Outlet />
    </>
  )
}

function HostPinPage() {
  const { unlock } = useHostAccess()
  const { tx } = useLang()
  const [pin, setPin] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  usePageTitle(tx('信念遊戲 · 主持密碼', 'Belief Game · Host password'))

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const parsedPin = parseHostPin(pin)
    const parsedCode = parseRoomCode(roomCode)
    if (!parsedPin.ok) {
      setError(bookingMessage(parsedPin.error))
      return
    }
    if (!parsedCode.ok) {
      setError(bookingMessage(parsedCode.error))
      return
    }
    setPending(true)
    setError(null)
    const result = await bookingApi.verifyHostPin({ pin: parsedPin.pin, roomCode: parsedCode.code })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    unlock({ scope: result.scope, roomCode: parsedCode.code, proofPin: parsedPin.pin })
    setPin('')
    setRoomCode('')
  }

  return (
    <Frame width="host">
      <main id="main">
        <BrandMark kicker="Host" />
        <h1 className="mt-10 text-[1.85rem] font-medium leading-snug">{tx('主持台', 'Host desk')}</h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
          {tx(
            '請輸入六位數字密碼。參加者加入房間不需要密碼。',
            'Enter the six-digit password. Participants join a room without a password.',
          )}
        </p>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          {tx(
            '平台營運者使用營運密碼。個別場次的主持請使用該場自行設定的密碼，並連同房間碼一併輸入。請勿把營運密碼交給租用場次的人。',
            'The platform operator uses the operator password. A session host uses the password set for that session, together with the room code. Do not give the operator password to someone renting a session.',
          )}
        </p>
        {liveBackend ? null : (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink">
            {tx(
              '此瀏覽器未連接資料庫。六位數字只會開啟本地預覽，不會核對平台密碼。',
              'This browser is not connected to the database. Any six digits open a local preview and do not check the platform password.',
            )}
          </p>
        )}
        <form className="mt-6 max-w-md" noValidate onSubmit={(event) => void onSubmit(event)}>
          <label className="block" htmlFor="host-pin">
            <span className="text-sm text-ink">{tx('六位數字密碼', 'Six-digit password')}</span>
            <Input
              id="host-pin"
              className="mt-2 tracking-[0.28em]"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={6}
              type="password"
              required
            />
          </label>
          <label className="mt-4 block" htmlFor="host-room-code">
            <span className="text-sm text-ink">{tx('房間碼（個別場次需要填寫）', 'Room code (required for a session password)')}</span>
            <Input
              id="host-room-code"
              className="mt-2 uppercase tracking-[0.14em]"
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={8}
            />
          </label>
          {error ? (
            <p className="mt-4 text-sm text-ink" role="alert">
              {error}
            </p>
          ) : null}
          <Button className="mt-5" type="submit" disabled={pending}>
            {pending ? tx('正在核對', 'Checking') : tx('進入主持台', 'Enter the host desk')}
          </Button>
        </form>
        <p className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link to="/host/setup" className="text-ink underline decoration-line underline-offset-4">
            {tx('我有領取碼，要設定本場密碼', 'I have a claim code and want to set this session’s password')}
          </Link>
          <Link to="/book" className="text-muted underline decoration-line underline-offset-4">
            {tx('預約頁', 'Booking page')}
          </Link>
          <Link to="/" className="text-muted underline decoration-line underline-offset-4">
            {tx('學員入口', 'Student entrance')}
          </Link>
        </p>
      </main>
    </Frame>
  )
}
