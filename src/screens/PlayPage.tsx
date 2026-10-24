import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { useGame } from '@/api/useGame'
import { BeliefCard } from '@/components/BeliefCard'
import { CardWave } from '@/components/CardWave'
import { Leaderboard } from '@/components/Leaderboard'
import { SelfPaceNotice } from '@/components/SelfPaceNotice'
import { BrandMark } from '@/components/BrandMark'
import { Frame } from '@/components/Frame'
import { SpeakControl } from '@/components/SpeakControl'
import { cardsFor, CHOICE_FACE_SRC } from '@/domain/cards'
import { advancePace, usePace } from '@/self/pace'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/lib/title'

function elapsedMs(startedAt: number) {
  return Math.max(0, Date.now() - startedAt)
}

export function PlayPage() {
  const state = useGame()
  const navigate = useNavigate()
  const deck = cardsFor(state.room.deck)
  const pace = usePace(state.room.code)
  const card = deck[pace.index] ?? null
  const [pending, setPending] = useState<'yes' | 'no' | null>(null)
  const [error, setError] = useState<string | null>(null)
  usePageTitle('信念遊戲 · 這一張')

  const paused = state.room.phase === 'paused'
  const number = Math.min(deck.length, pace.index + 1)

  async function choose(choiceId: 'yes' | 'no') {
    if (!card || pace.done || pending || paused) return
    setPending(choiceId)
    setError(null)
    const timeMs = elapsedMs(pace.cardStartedAt)
    const result = await api.submitSelfPaced({ cardId: card.id, choiceId, timeMs })
    setPending(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    const next = advancePace(
      state.room.code,
      { cardId: card.id, choiceId, ms: timeMs, isCorrect: result.isCorrect },
      deck.length,
    )
    if (next.done) navigate('/play/final', { replace: true })
  }

  return (
    <Frame>
      <main id="main">
        <BrandMark />
        <p className="mt-8 text-sm text-muted">
          第 {number} 張，共 {deck.length} 張
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">選好就到下一張。不用等主持揭示。</p>
        <div className="mt-3">
          <SelfPaceNotice link={state.selfPaceLink} />
        </div>
        {paused ? <p className="mt-2 text-sm text-ink">主持暫停咗。先等一等，這一刻不能選。</p> : null}

        {card ? (
          <div className="mt-5">
            <BeliefCard theme={card.theme} text={card.text} imageSrc={card.imageSrc} />
          </div>
        ) : (
          <p className="mt-8 text-muted">這一套已經看完。</p>
        )}

        {card ? (
          <div className="mt-5 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2" role="group" aria-label="是或毫無道理">
            {card.options.map((option) => {
              const choiceId = option.id === 'no' ? 'no' : 'yes'
              const selected = pending === choiceId
              const yes = choiceId === 'yes'
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-label={option.label}
                  aria-pressed={selected}
                  disabled={pending != null || paused}
                  onClick={() => void choose(choiceId)}
                  className={cn(
                    'flex min-h-16 items-center gap-3 rounded-full border px-2 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender disabled:opacity-100',
                    yes
                      ? 'border-[#b7e0d8] bg-[#f4fbf8] hover:bg-[#e7f7f3]'
                      : 'border-[#f3c3cf] bg-[#fff6f8] hover:bg-[#ffeff3]',
                    selected ? 'ring-2 ring-lavender' : '',
                    pending != null && !selected ? 'opacity-60' : '',
                  )}
                >
                  <span className="size-12 shrink-0 overflow-hidden rounded-full bg-white">
                    <img src={CHOICE_FACE_SRC[choiceId]} alt="" className="size-full object-cover" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg font-medium leading-tight text-ink">{yes ? '是' : '毫無道理'}</span>
                    <span className="block text-xs tracking-[0.14em] text-muted">{yes ? 'YES' : 'NO'}</span>
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 text-sm text-ink" role="alert">
            {error}
          </p>
        ) : (
          <p className="mt-4 min-h-6 text-sm text-muted">
            {pending ? '正在記下' : '點選是，或毫無道理。'}
          </p>
        )}
        <div className="mt-6">
          <CardWave pace={pace.answers} variant="compact" />
        </div>
        <div className="mt-4">
          <Leaderboard pace={pace.answers} variant="compact" />
        </div>
        <div className="mt-4">
          <SpeakControl />
        </div>
      </main>
    </Frame>
  )
}
