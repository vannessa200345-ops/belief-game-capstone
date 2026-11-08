import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { bookingApi } from '@/booking/api'
import { bookingMessage } from '@/booking/messages'
import { parseClaimToken, parseHostPin, parseRoomCode } from '@/booking/rules'
import { BrandMark } from '@/components/BrandMark'
import { Frame } from '@/components/Frame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useHostAccess } from '@/host/access'
import { useLang } from '@/i18n/lang'
import { usePageTitle } from '@/lib/title'

export function HostSetupPage() {
  const { tx } = useLang()
  const navigate = useNavigate()
  const { unlock } = useHostAccess()
  const [token, setToken] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState<{ roomCode: string; pin: string } | null>(null)
  const [pending, setPending] = useState(false)
  usePageTitle(tx('信念遊戲 · 設定本場密碼', 'Belief Game · Set a session password'))

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const parsedToken = parseClaimToken(token)
    const parsedCode = parseRoomCode(roomCode)
    const parsedPin = parseHostPin(pin)
    if (!parsedToken.ok) {
      setError(bookingMessage(parsedToken.error))
      return
    }
    if (!parsedCode.ok || !parsedCode.code) {
      setError(bookingMessage('room_code'))
      return
    }
    if (!parsedPin.ok) {
      setError(bookingMessage(parsedPin.error))
      return
    }
    if (pin !== confirm) {
      setError(tx('兩次輸入的密碼不相同。', 'The two passwords do not match.'))
      return
    }
    setPending(true)
    setError(null)
    const result = await bookingApi.claimSessionPin({
      claimToken: parsedToken.token,
      roomCode: parsedCode.code,
      newPin: parsedPin.pin,
    })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setReady({ roomCode: parsedCode.code, pin: parsedPin.pin })
    setPin('')
    setConfirm('')
    setToken('')
  }

  function enterDesk() {
    if (!ready) return
    unlock({ scope: 'session', roomCode: ready.roomCode, proofPin: ready.pin })
    navigate('/host')
  }

  return (
    <Frame width="host">
      <main id="main">
        <BrandMark kicker="Host" />
        <h1 className="mt-10 text-[1.85rem] font-medium leading-snug">{tx('設定本場主持密碼', 'Set this session’s host password')}</h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
          {tx(
            '請輸入場次領取碼、房間碼，以及你要使用的六位數字密碼。設定完成後，請用本場密碼進入主持台。請勿使用或轉發營運密碼。',
            'Enter the claim code, the room code, and the six-digit password you want to use. After that, enter the host desk with this session’s password. Do not use or forward the operator password.',
          )}
        </p>
        {ready ? (
          <div className="mt-6 max-w-md rounded-[28px] border border-line bg-white px-6 py-6" role="status">
            <p className="text-base text-ink">{tx('本場密碼已設定。', 'This session’s password is set.')}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {tx(
                `房間碼 ${ready.roomCode}。重新整理頁面後，需要再輸入本場密碼。`,
                `Room code ${ready.roomCode}. After a refresh, enter this session’s password again.`,
              )}
            </p>
            <Button className="mt-4" onClick={enterDesk}>
              {tx('進入主持台', 'Enter the host desk')}
            </Button>
          </div>
        ) : (
          <form className="mt-6 max-w-md" noValidate onSubmit={(event) => void onSubmit(event)}>
            <label className="block" htmlFor="claim-token">
              <span className="text-sm text-ink">{tx('領取碼', 'Claim code')}</span>
              <Input
                id="claim-token"
                className="mt-2 font-latin tracking-wide"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
              />
            </label>
            <label className="mt-4 block" htmlFor="claim-room">
              <span className="text-sm text-ink">{tx('房間碼', 'Room code')}</span>
              <Input
                id="claim-room"
                className="mt-2 uppercase tracking-[0.14em]"
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={8}
                required
              />
            </label>
            <label className="mt-4 block" htmlFor="claim-pin">
              <span className="text-sm text-ink">{tx('本場六位數字密碼', 'Six-digit password for this session')}</span>
              <Input
                id="claim-pin"
                className="mt-2 tracking-[0.28em]"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                required
              />
            </label>
            <label className="mt-4 block" htmlFor="claim-pin-again">
              <span className="text-sm text-ink">{tx('再輸入一次', 'Enter it again')}</span>
              <Input
                id="claim-pin-again"
                className="mt-2 tracking-[0.28em]"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value.replace(/\D/g, '').slice(0, 6))}
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                required
              />
            </label>
            {error ? (
              <p className="mt-4 text-sm text-ink" role="alert">
                {error}
              </p>
            ) : null}
            <Button className="mt-5" type="submit" disabled={pending}>
              {pending ? tx('正在設定', 'Saving') : tx('設定本場密碼', 'Set the session password')}
            </Button>
          </form>
        )}
        <p className="mt-8">
          <Link to="/host" className="text-sm text-muted underline decoration-line underline-offset-4">
            {tx('返回主持台', 'Back to the host desk')}
          </Link>
        </p>
      </main>
    </Frame>
  )
}
