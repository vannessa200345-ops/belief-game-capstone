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
import { cardsFor, CHOICE_CARD_SRC } from '@/domain/cards'
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
          <div className="mt-5 grid grid-cols-2 items-start gap-3" role="group" aria-label="是或毫無道理">
            {card.options.map((option) => {
              const choiceId = option.id === 'no' ? 'no' : 'yes'
              const selected = pending === choiceId
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-label={option.label}
                  aria-pressed={selected}
                  disabled={pending != null || paused}
                  onClick={() => void choose(choiceId)}
                  className={cn(
                    'overflow-hidden rounded-[22px] border border-transparent bg-transparent p-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender disabled:opacity-100',
                    selected ? 'ring-2 ring-lavender' : 'hover:brightness-[1.03]',
                    pending != null && !selected ? 'opacity-60' : '',
                  )}
                >
                  <img src={CHOICE_CARD_SRC[choiceId]} alt="" className="block h-auto w-full" />
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
