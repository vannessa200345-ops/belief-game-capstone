import { cardLine } from './cards.ts'
import { playOrder } from './order.ts'
import type { DeckId } from './types.ts'

export type ReportLang = 'zh' | 'en'

export type BeliefGroup = 'worth' | 'fear' | 'money' | 'bond' | 'strain' | 'trust' | 'ease' | 'belief'

export interface ReportAnswer {
  cardId: string
  choiceId: 'yes' | 'no'
  ms: number
  correct: boolean | null
}

export interface ReportCard {
  cardId: string
  number: number
  text: string
  imageSrc: string
  ms: number
  choiceId: 'yes' | 'no'
  correct: boolean | null
  group: BeliefGroup
  mostSure: boolean
  mostHesitant: boolean
}

export interface ReportGroup {
  group: BeliefGroup
  label: string
  wrong: number
  answered: number
  avgMs: number | null
  watch: boolean
  suggestion: string
}

export interface WrongCard {
  cardId: string
  number: number
  text: string
  imageSrc: string
  choiceId: 'yes' | 'no'
  why: string
}

export interface SessionReport {
  name: string
  totalCards: number
  answered: number
  correct: number
  wrong: number
  missed: number
  avgMs: number | null
  graded: boolean
  sure: ReportCard[]
  hesitant: ReportCard[]
  cards: ReportCard[]
  groups: ReportGroup[]
  watch: ReportGroup[]
  wrongCards: WrongCard[]
}

/** 用牌面中文歸類。只描述呢句說話本身，唔讀場外資料。 */
export function beliefGroup(text: string): BeliefGroup {
  if (/錢|財富|窮|富足|豐盛|付不起|有錢|匱乏|匿乏/.test(text)) return 'money'
  if (/伴侶|愛情|愛的人|前任|背叛|忠誠|關係/.test(text)) return 'bond'
  if (/害怕|恐懼|憎恨|擔心/.test(text)) return 'fear'
  if (/值得|不夠好|不足夠|不足|恨我自己|愛我自己|有罪|不夠/.test(text)) return 'worth'
  if (/執著|辛苦|艱苦|痛苦|壓力/.test(text)) return 'strain'
  if (/信任|直覺|自由|和諧/.test(text)) return 'trust'
  if (/健康|生病|放鬆|輕鬆/.test(text)) return 'ease'
  return 'belief'
}

export function groupLabel(group: BeliefGroup, lang: ReportLang): string {
  const labels: Record<BeliefGroup, { zh: string; en: string }> = {
    worth: { zh: '自我價值', en: 'Self-worth' },
    fear: { zh: '恐懼', en: 'Fear' },
    money: { zh: '金錢與豐盛', en: 'Money and abundance' },
    bond: { zh: '關係與愛', en: 'Love and relationships' },
    strain: { zh: '辛苦與執著', en: 'Strain and attachment' },
    trust: { zh: '信任與自由', en: 'Trust and freedom' },
    ease: { zh: '身心與輕鬆', en: 'Ease and health' },
    belief: { zh: '其他信念', en: 'Other beliefs' },
  }
  return labels[group][lang]
}

function whyWrong(choiceId: 'yes' | 'no', lang: ReportLang): string {
  if (choiceId === 'yes') {
    return lang === 'en'
      ? 'You chose Yes. In this session that does not match the reference direction. The reference for this line is No: it is a limiting belief to release, not one to agree with.'
      : '你揀咗「是」。呢一場呢句同參考方向唔同。參考方向係「毫無道理」：呢句係限制性、宜放下嘅信念，唔係要認同一句。'
  }
  return lang === 'en'
    ? 'You chose No. In this session that does not match the reference direction. The reference for this line is Yes: it is a healthier belief worth keeping.'
    : '你揀咗「毫無道理」。呢一場呢句同參考方向唔同。參考方向係「是」：呢句係較健康、值得留低嘅信念。'
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function buildSessionReport(input: {
  lang: ReportLang
  name: string
  deck: DeckId
  roomCode: string
  answers: ReportAnswer[]
}): SessionReport {
  const order = playOrder(input.deck, input.roomCode)
  const byId = new Map(input.answers.map((answer) => [answer.cardId, answer]))
  const gradedAnswers = input.answers.filter((answer) => answer.correct === true || answer.correct === false)
  const graded = input.answers.length > 0 && gradedAnswers.length === input.answers.length
  const times = input.answers.map((answer) => answer.ms).filter((ms) => ms >= 0)
  const shortest = times.length > 0 ? Math.min(...times) : null
  const longest = times.length > 0 ? Math.max(...times) : null

  const cards: ReportCard[] = []
  for (const [index, card] of order.entries()) {
    const answer = byId.get(card.id)
    if (!answer) continue
    const group = beliefGroup(card.text)
    cards.push({
      cardId: card.id,
      number: index + 1,
      text: cardLine(card, input.lang),
      imageSrc: card.imageSrc,
      ms: answer.ms,
      choiceId: answer.choiceId,
      correct: answer.correct,
      group,
      mostSure: shortest != null && answer.ms === shortest,
      mostHesitant: longest != null && answer.ms === longest,
    })
  }

  const wrongCards: WrongCard[] = cards
    .filter((card) => card.correct === false)
    .map((card) => ({
      cardId: card.cardId,
      number: card.number,
      text: card.text,
      imageSrc: card.imageSrc,
      choiceId: card.choiceId,
      why: whyWrong(card.choiceId, input.lang),
    }))

  const groupIds: BeliefGroup[] = ['worth', 'fear', 'money', 'bond', 'strain', 'trust', 'ease', 'belief']
  const groups: ReportGroup[] = groupIds
    .map((group) => {
      const rows = cards.filter((card) => card.group === group)
      const missedLines = rows.filter((card) => card.correct === false)
      const watch = missedLines.length > 0
      const quotes = missedLines.map((card) => `「${card.text}」`).join(input.lang === 'en' ? ', ' : '、')
      const suggestion = !watch
        ? ''
        : input.lang === 'en'
          ? `Pause on the ${missedLines.length} line${missedLines.length === 1 ? '' : 's'} in this group that differed from the reference this session: ${quotes}.`
          : `呢一組呢一場有 ${missedLines.length} 句同參考方向唔同，可以再停一停：${quotes}。`
      return {
        group,
        label: groupLabel(group, input.lang),
        wrong: missedLines.length,
        answered: rows.length,
        avgMs: average(rows.map((card) => card.ms)),
        watch,
        suggestion,
      }
    })
    .filter((group) => group.answered > 0)

  const correct = cards.filter((card) => card.correct === true).length
  const wrong = wrongCards.length

  return {
    name: input.name,
    totalCards: order.length,
    answered: cards.length,
    correct,
    wrong,
    missed: Math.max(0, order.length - cards.length),
    avgMs: average(cards.map((card) => card.ms)),
    graded,
    sure: cards.filter((card) => card.mostSure),
    hesitant: cards.filter((card) => card.mostHesitant),
    cards,
    groups,
    watch: groups.filter((group) => group.watch),
    wrongCards,
  }
}
