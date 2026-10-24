import { useSyncExternalStore } from 'react'

const PACE_KEY = 'belief-self-pace'

export interface PaceAnswer {
  cardId: string
  choiceId: 'yes' | 'no'
  ms: number
  isCorrect: boolean | null
}

export interface PaceState {
  roomCode: string
  index: number
  cardStartedAt: number
  answers: PaceAnswer[]
  done: boolean
}

let memory: PaceState | null = null
const listeners = new Set<() => void>()

function empty(roomCode: string): PaceState {
  return { roomCode, index: 0, cardStartedAt: Date.now(), answers: [], done: false }
}

function emit() {
  for (const listener of listeners) listener()
}

function persist(next: PaceState) {
  memory = next
  try {
    sessionStorage.setItem(PACE_KEY, JSON.stringify(next))
  } catch {
    /* 這一頁仍可答完。 */
  }
  emit()
}

export function readPace(roomCode: string): PaceState {
  if (!roomCode) return empty('')
  if (memory?.roomCode === roomCode) return memory
  try {
    const raw = sessionStorage.getItem(PACE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as PaceState
      if (
        parsed &&
        parsed.roomCode === roomCode &&
        Array.isArray(parsed.answers) &&
        typeof parsed.index === 'number'
      ) {
        memory = {
          roomCode,
          index: parsed.index,
          cardStartedAt: typeof parsed.cardStartedAt === 'number' ? parsed.cardStartedAt : Date.now(),
          answers: parsed.answers.filter(
            (answer) =>
              answer &&
              typeof answer.cardId === 'string' &&
              (answer.choiceId === 'yes' || answer.choiceId === 'no'),
          ),
          done: Boolean(parsed.done),
        }
        return memory
      }
    }
  } catch {
    /* 重新由第一張開始。 */
  }
  memory = empty(roomCode)
  return memory
}

export function subscribePace(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePace(roomCode: string) {
  return useSyncExternalStore(
    subscribePace,
    () => readPace(roomCode),
    () => empty(roomCode),
  )
}

export function clearPace() {
  memory = null
  try {
    sessionStorage.removeItem(PACE_KEY)
  } catch {
    /* 離開房間仍可繼續。 */
  }
  emit()
}

export function advancePace(roomCode: string, answer: PaceAnswer, total: number) {
  const current = readPace(roomCode)
  const answers = current.answers.some((item) => item.cardId === answer.cardId)
    ? current.answers
    : [...current.answers, answer]
  const index = Math.min(total, answers.length)
  const next: PaceState = {
    roomCode,
    index,
    cardStartedAt: Date.now(),
    answers,
    done: total > 0 && index >= total,
  }
  persist(next)
  return next
}
