import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/api'
import { useGame } from '@/api/useGame'
import { BrandMark } from '@/components/BrandMark'
import { NoticeEmailField } from '@/components/NoticeEmailField'
import { Frame } from '@/components/Frame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePageTitle } from '@/lib/title'

export function JoinPage() {
  const state = useGame()
  const params = useParams()
  const inviteCode = params.code?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) ?? ''
  const [draftCode, setDraftCode] = useState<string | null>(inviteCode || null)
  const code = draftCode ?? (inviteCode || state.room.code)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  usePageTitle('信念遊戲 · 進入房間')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await api.joinRoom({ code, name, email })
    if (!result.ok) setError(result.error)
    setPending(false)
  }

  return (
    <Frame>
      <main id="main">
        <BrandMark />
        <h1 className="mt-16 text-[1.85rem] font-medium leading-snug text-ink">
          用卡片，練習看清楚自己的信念
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          {inviteCode ? '房間碼已帶上。留下名字就可以坐下。' : '輸入房間碼，進來就可以坐下。'}
        </p>

        <form className="mt-10 space-y-5" noValidate onSubmit={(event) => void onSubmit(event)}>
          <label className="block">
            <span className="text-sm text-ink">房間碼</span>
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
            <span className="text-sm text-ink">你的名字</span>
            <Input
              className="mt-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={32}
              placeholder="怎樣稱呼你"
            />
          </label>
          <NoticeEmailField id="join-email" value={email} onChange={setEmail} />
          {error ? (
            <p className="text-sm text-ink" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? '正在進入' : '進入房間'}
          </Button>
        </form>

        <p className="mt-6 text-sm leading-relaxed text-muted">
          人數大約二十人最剛好，最多三十人。視像會議請另開 Zoom 或 Meet。這裡只負責看卡、作答，以及排隊發言。
        </p>
        <p className="mt-10">
          <Link
            to="/host"
            className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
          >
            我是主持
          </Link>
        </p>
      </main>
    </Frame>
  )
}
