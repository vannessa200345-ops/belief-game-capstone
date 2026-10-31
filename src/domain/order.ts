import { cardsFor } from './cards.ts'
import type { BeliefCard, DeckId } from './types.ts'

function hashSeed(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number) {
  let state = seed || 1
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let next = Math.imul(state ^ (state >>> 15), 1 | state)
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 每一場用房間碼打亂次序。同一房間碼每次都係同一序，遲入嚟嘅人先對到。
 * 新開一場會有新房間碼，所以次序會再亂一次。
 */
export function playOrder(deck: DeckId, roomCode: string): BeliefCard[] {
  const cards = cardsFor(deck)
  if (!roomCode) return cards
  const next = [...cards]
  const random = mulberry32(hashSeed(`${roomCode}:${deck}`))
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const current = next[index]
    const other = next[swap]
    if (!current || !other) continue
    next[index] = other
    next[swap] = current
  }
  return next
}

export function playOrderIds(deck: DeckId, roomCode: string): string[] {
  return playOrder(deck, roomCode).map((card) => card.id)
}
