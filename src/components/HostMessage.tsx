import { useState, type FormEvent } from 'react'
import { api } from '@/api'
import { useGame } from '@/api/useGame'
import { useLang } from '@/i18n/lang'
import { Button } from './ui/button'

export function HostMessage({ audience }: { audience: 'player' | 'host' }) {
  const state = useGame()
  const { tx } = useLang()
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = state.room.phase === 'playing' || state.room.phase === 'paused' || state.room.phase === 'final'
  if (!open) return null

  const notes =
    audience === 'host'
      ? state.notes
      : state.notes.filter((note) => note.fromHost || note.playerId === state.youId)

  async function send(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await api.sendNote(text, audience === 'host')
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setText('')
  }

  return (
    <section className="rounded-[24px] border border-line bg-white/80 px-4 py-4">
      <h2 className="text-base font-medium">{tx('傳字俾主持', 'Message the host')}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {audience === 'host'
          ? tx('學員唔使開咪。呢度睇到佢哋打嚟嘅字，你亦可以回覆。', 'Learners do not need a mic. Messages land here, and you can reply.')
          : tx('唔使開咪。打一句，主持喺主持台睇到。', 'No mic needed. Type a line and the host sees it on the console.')}
      </p>
      {notes.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{tx('暫時未有字。', 'No messages yet.')}</p>
      ) : (
        <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
          {notes.map((note) => (
            <li key={note.id} className="rounded-2xl bg-[#f7fbfe] px-3 py-2">
              <p className="text-sm text-ink">
                <span className="text-muted">{note.fromHost ? tx('主持', 'Host') : note.name}</span>
                <span className="mt-1 block">{note.text}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
      <form className="mt-3" onSubmit={(event) => void send(event)}>
        <label className="block text-sm text-ink" htmlFor={`note-${audience}`}>
          {tx('你想講嘅一句', 'Your message')}
        </label>
        <textarea
          id={`note-${audience}`}
          value={text}
          maxLength={240}
          rows={3}
          onChange={(event) => setText(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-lavender"
          placeholder={tx('例如：呢張我想再問。', 'For example: I want to ask about this card.')}
        />
        {error ? (
          <p className="mt-2 text-sm text-ink" role="alert">
            {error}
          </p>
        ) : null}
        <Button className="mt-3" type="submit" disabled={pending || text.trim().length === 0}>
          {pending ? tx('正在送出', 'Sending') : tx('送出文字', 'Send text')}
        </Button>
      </form>
    </section>
  )
}
