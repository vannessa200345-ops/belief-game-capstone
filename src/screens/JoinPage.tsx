import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api'
import { BrandMark } from '@/components/BrandMark'
import { Frame } from '@/components/Frame'
import { NextStep } from '@/components/NextStep'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLang } from '@/i18n/lang'
import { usePageTitle } from '@/lib/title'

function cleanCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

function codeFromPaste(value: string) {
  const trimmed = value.trim()
  const fromLink = trimmed.match(/\/r\/([A-Za-z0-9]{2,8})/i)
  if (fromLink?.[1]) return cleanCode(fromLink[1])
  if (trimmed.includes('/') || /^https?:/i.test(trimmed)) return ''
  return cleanCode(trimmed)
}

export function JoinPage() {
  const { tx } = useLang()
  const params = useParams()
  const location = useLocation()
  const inviteCode = cleanCode(params.code ?? '')
  const openName = (location.state as { step?: string } | null)?.step === 'name'
  const [step, setStep] = useState<'arrive' | 'name'>(openName && inviteCode ? 'name' : 'arrive')
  const [stepCode, setStepCode] = useState(inviteCode)
  if (stepCode !== inviteCode) {
    setStepCode(inviteCode)
    setStep(openName && inviteCode ? 'name' : 'arrive')
  }
  usePageTitle(tx('信念遊戲 · 進入房間', 'Belief Game · Enter'))

  if (step === 'name' && inviteCode) {
    return <NameStep code={inviteCode} onBack={() => setStep('arrive')} />
  }

  return <ArriveStep inviteCode={inviteCode} onEnter={() => setStep('name')} />
}

function ArriveStep({ inviteCode, onEnter }: { inviteCode: string; onEnter: () => void }) {
  const { tx } = useLang()
  const navigate = useNavigate()

  function useManualCode(code: string) {
    const next = cleanCode(code)
    if (!next) return
    navigate(`/r/${next}`)
  }

  return (
    <Frame>
      <main id="main">
        <BrandMark />
        {inviteCode ? (
          <>
            <h1 className="mt-10 text-[1.85rem] font-medium leading-snug text-ink">
              {tx('用卡片，練習看清楚自己的信念', 'Use the cards to see your beliefs more clearly')}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted">
              {tx('主持嘅連結已經帶你到呢間房。唔使打房間碼。', 'The host’s link already opened this room. You do not type a room code.')}
            </p>
            <p className="mt-4 text-sm text-muted">
              {tx('房間', 'Room')} <span className="font-latin tracking-[0.16em] text-ink">{inviteCode}</span>
            </p>
            <div className="mt-6">
              <NextStep label={tx('下一步：', 'Next: ')}>
                {tx('撳下面個大掣。下一版先寫你嘅名。', 'press the large button. Your name comes on the next screen.')}
              </NextStep>
            </div>
            <Button
              type="button"
              className="mt-6 h-[4.5rem] w-full rounded-full bg-[#ef5b45] text-lg tracking-wide text-white shadow-[0_14px_30px_rgba(239,91,69,0.28)] hover:bg-[#e14e38]"
              onClick={onEnter}
            >
              {tx('進入房間', 'Enter the room')}
            </Button>
          </>
        ) : (
          <HomeContinue />
        )}

        {inviteCode ? (
          <QuietCode label={tx('唔係呢間房？', 'Not this room?')} onCode={useManualCode} />
        ) : null}
        <p className="mt-8">
          <Link to="/host" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
            {tx('我是主持', 'I am the host')}
          </Link>
        </p>
      </main>
    </Frame>
  )
}

function HomeContinue() {
  const { tx } = useLang()
  const navigate = useNavigate()
  const field = useRef<HTMLInputElement>(null)
  const [paste, setPaste] = useState('')
  const [open, setOpen] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  function enter() {
    const code = codeFromPaste(paste)
    if (!code) {
      setOpen(true)
      setHint(tx('貼上連結，或者房間碼。', 'Paste the link, or a room code.'))
      window.setTimeout(() => field.current?.focus(), 0)
      return
    }
    navigate(`/r/${code}`, { state: { step: 'name' } })
  }

  return (
    <>
      <h1 className="mt-10 text-[1.85rem] font-medium leading-snug text-ink">
        {tx('用卡片，練習看清楚自己的信念', 'Use the cards to see your beliefs more clearly')}
      </h1>
      <Button
        type="button"
        className="mt-8 h-[4.5rem] w-full rounded-full bg-[#ef5b45] text-lg tracking-wide text-white shadow-[0_14px_30px_rgba(239,91,69,0.28)] hover:bg-[#e14e38]"
        onClick={enter}
      >
        {tx('進入房間', 'Enter the room')}
      </Button>
      {open ? (
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault()
            enter()
          }}
        >
          <label className="block">
            <span className="text-xs text-muted">{tx('連結或房間碼', 'Link or room code')}</span>
            <Input
              ref={field}
              className="mt-1 h-9 px-3 text-sm"
              value={paste}
              onChange={(event) => {
                setPaste(event.target.value)
                setHint(null)
              }}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              placeholder={tx('貼上連結', 'Paste a link')}
              aria-label={tx('連結或房間碼', 'Link or room code')}
            />
          </label>
          {hint ? <p className="mt-2 text-sm text-ink">{hint}</p> : null}
        </form>
      ) : (
        <button
          type="button"
          className="mt-4 text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
          onClick={() => {
            setOpen(true)
            window.setTimeout(() => field.current?.focus(), 0)
          }}
        >
          {tx('貼上連結', 'Paste a link')}
        </button>
      )}
    </>
  )
}

function NameStep({ code, onBack }: { code: string; onBack: () => void }) {
  const { tx } = useLang()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await api.joinRoom({ code, name })
    if (!result.ok) setError(result.error)
    setPending(false)
  }

  return (
    <Frame>
      <main id="main">
        <BrandMark />
        <p className="mt-10 text-sm text-muted">
          {tx('房間', 'Room')} <span className="font-latin tracking-[0.16em] text-ink">{code}</span>
        </p>
        <h1 className="mt-2 text-[1.85rem] font-medium leading-snug text-ink">
          {tx('點稱呼你', 'What should we call you')}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          {tx('主持同埋呢場嘅人會見到呢個名。', 'The host and people in this session will see this name.')}
        </p>
        <form className="mt-8" noValidate onSubmit={(event) => void onSubmit(event)}>
          <label className="block">
            <span className="text-sm text-ink">{tx('你的名字', 'Your name')}</span>
            <Input
              className="mt-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              autoFocus
              maxLength={32}
              placeholder={tx('怎樣稱呼你', 'Your name')}
              aria-invalid={error != null}
            />
          </label>
          <div className="mt-6">
            <NextStep label={tx('下一步：', 'Next: ')}>
              {tx('寫低名，再撳下面個大掣。', 'add your name, then press the large button.')}
            </NextStep>
          </div>
          {error ? (
            <p className="mt-4 text-sm text-ink" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            className="mt-6 h-[4.5rem] w-full rounded-full bg-[#ef5b45] text-lg tracking-wide text-white shadow-[0_14px_30px_rgba(239,91,69,0.28)] hover:bg-[#e14e38]"
            disabled={pending}
          >
            {pending ? tx('正在進入', 'Entering') : tx('進入房間', 'Enter the room')}
          </Button>
        </form>
        <button
          type="button"
          className="mt-6 text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
          onClick={onBack}
        >
          {tx('返回', 'Back')}
        </button>
      </main>
    </Frame>
  )
}

function QuietCode({ label, onCode }: { label: string; onCode: (code: string) => void }) {
  const { tx } = useLang()
  const [code, setCode] = useState('')

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    onCode(code)
  }

  return (
    <details className="mt-8 text-sm text-muted">
      <summary className="cursor-pointer underline decoration-line underline-offset-4">{label}</summary>
      <form className="mt-3" noValidate onSubmit={onSubmit}>
        <label className="block">
          <span className="text-xs text-muted">{tx('房間碼（可選）', 'Room code (optional)')}</span>
          <Input
            className="mt-1 h-9 px-3 text-sm tracking-[0.14em] uppercase"
            value={code}
            onChange={(event) => setCode(cleanCode(event.target.value))}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            maxLength={8}
            placeholder="AB12"
            aria-label={tx('房間碼', 'Room code')}
          />
        </label>
        <button type="submit" className="mt-2 text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
          {tx('用呢個碼', 'Use this code')}
        </button>
      </form>
    </details>
  )
}
