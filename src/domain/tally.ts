export interface TallyPerson {
  playerId: string
  name: string
  matched: number
  differed: number
  pending: number
}

export interface TallyCard {
  cardId: string
  number: number
  matched: number
  differed: number
}

export interface LiveTally {
  keyed: boolean
  matched: number
  differed: number
  pending: number
  people: TallyPerson[]
  cards: TallyCard[]
}

interface TallyPlayer {
  id: string
  name: string
  host?: boolean
  demo?: boolean
}

interface TallyAnswer {
  playerId: string
  cardId: string
  correct: boolean | null
}

/**
 * 用本場已儲存的選擇做計分。同一人同一張只保留最後一筆。
 * 主持與示範學員不計入。correct 為 null 的選擇列入未核對，不算一致，也不算不同。
 */
export function tallySession(input: {
  keyed: boolean
  players: TallyPlayer[]
  answers: TallyAnswer[]
  order: { id: string }[]
}): LiveTally {
  if (!input.keyed) {
    return { keyed: false, matched: 0, differed: 0, pending: 0, people: [], cards: [] }
  }

  const learners = input.players.filter((player) => !player.host && !player.demo)
  const learnerIds = new Set(learners.map((player) => player.id))
  const latest = new Map<string, TallyAnswer>()
  for (const answer of input.answers) {
    if (!learnerIds.has(answer.playerId)) continue
    latest.set(`${answer.playerId}:${answer.cardId}`, answer)
  }

  const people = new Map<string, TallyPerson>()
  for (const player of learners) {
    people.set(player.id, { playerId: player.id, name: player.name, matched: 0, differed: 0, pending: 0 })
  }

  const byCard = new Map<string, { matched: number; differed: number }>()
  let matched = 0
  let differed = 0
  let pending = 0

  for (const answer of latest.values()) {
    const person = people.get(answer.playerId)
    if (!person) continue
    if (answer.correct === true) {
      person.matched += 1
      matched += 1
      const card = byCard.get(answer.cardId) ?? { matched: 0, differed: 0 }
      card.matched += 1
      byCard.set(answer.cardId, card)
    } else if (answer.correct === false) {
      person.differed += 1
      differed += 1
      const card = byCard.get(answer.cardId) ?? { matched: 0, differed: 0 }
      card.differed += 1
      byCard.set(answer.cardId, card)
    } else {
      person.pending += 1
      pending += 1
    }
  }

  const numbers = new Map(input.order.map((card, index) => [card.id, index + 1]))
  const cards: TallyCard[] = []
  for (const [cardId, counts] of byCard) {
    if (counts.differed === 0) continue
    cards.push({
      cardId,
      number: numbers.get(cardId) ?? 0,
      matched: counts.matched,
      differed: counts.differed,
    })
  }
  cards.sort((a, b) => b.differed - a.differed || a.number - b.number)

  const roster = [...people.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
  return { keyed: true, matched, differed, pending, people: roster, cards }
}

export function tallyRate(tally: Pick<LiveTally, 'matched' | 'differed'>): number | null {
  const checked = tally.matched + tally.differed
  if (checked === 0) return null
  return tally.matched / checked
}
