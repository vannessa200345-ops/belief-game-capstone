import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/api'
import { useGame } from '@/api/useGame'
import { BrandMark } from '@/components/BrandMark'
import { Frame } from '@/components/Frame'
import { NextStep } from '@/components/NextStep'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLang } from '@/i18n/lang'
import { usePageTitle } from '@/lib/title'

export function JoinPage() {
  const state = useGame()
  const { tx } = useLang()
  const params = useParams()
  const inviteCode = params.code?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) ?? ''
  const [draftCode, setDraftCode] = useState<string | null>(inviteCode || null)
  const code = draftCode ?? (inviteCode || state.room.code)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  usePageTitle(tx('信念遊戲 · 進入房間', 'Belief Game · Enter'))

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
        <h1 className="mt-10 text-[1.85rem] font-medium leading-snug text-ink">
          {tx('用卡片，練習看清楚自己的信念', 'Use the cards to see your beliefs more clearly')}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          {inviteCode
            ? tx('房間碼已帶上。寫低名字，然後撳下面個大掣。', 'The room code is filled in. Add your name, then press the large button.')
            : tx('寫低房間碼同名字，然後撳下面個大掣。', 'Add the room code and your name, then press the large button.')}
        </p>

        <form className="mt-8 space-y-5" noValidate onSubmit={(event) => void onSubmit(event)}>
          <label className="block">
            <span className="text-sm text-ink">{tx('房間碼', 'Room code')}</span>
            <Input
              className="mt-2 h-16 text-center font-latin text-2xl tracking-[0.22em] uppercase"
              value={code}
              onChange={(event) => setDraftCode(event.target.value.toUpperCase().slice(0, 8))}
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              maxLength={8}
              placeholder="AB12CD"
              aria-invalid={error != null}
            />
          </label>
          <label className="block">
            <span className="text-sm text-ink">{tx('你的名字', 'Your name')}</span>
            <Input
              className="mt-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={32}
              placeholder={tx('怎樣稱呼你', 'What should we call you')}
            />
          </label>
          <NextStep label={tx('下一步：', 'Next: ')}>
            {tx('撳下面個大掣，進入房間。', 'press the large button to enter the room.')}
          </NextStep>
          {error ? (
            <p className="text-sm text-ink" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            className="h-[4.5rem] w-full rounded-full bg-[#ef5b45] text-lg tracking-wide text-white shadow-[0_14px_30px_rgba(239,91,69,0.28)] hover:bg-[#e14e38]"
            disabled={pending}
          >
            {pending ? tx('正在進入', 'Entering') : tx('進入房間', 'Enter the room')}
          </Button>
        </form>

        <p className="mt-6 text-sm leading-relaxed text-muted">
          {tx(
            '人數大約二十人最剛好，最多三十人。視像會議請另開 Zoom 或 Meet。這裡只負責看卡、作答，以及傳字俾主持。',
            'About twenty people is ideal, thirty is the maximum. Keep video on Zoom or Meet. This room is for the cards, your choices, and text to the host.',
          )}
        </p>
        <p className="mt-10">
          <Link to="/host" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
            {tx('我是主持', 'I am the host')}
          </Link>
        </p>
      </main>
    </Frame>
  )
}
