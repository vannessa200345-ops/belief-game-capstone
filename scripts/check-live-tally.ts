import assert from 'node:assert/strict'
import test from 'node:test'
import { personStatus, tallyRate, tallySession } from '../src/domain/tally.ts'

const players = [
  { id: 'host', name: '主持', host: true },
  { id: 'demo', name: '示範', demo: true },
  { id: 'a', name: '陳可恩' },
  { id: 'b', name: '林子朗' },
]

const order = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }]

test('latest graded answer wins and unchecked answers stay out of both totals', () => {
  const tally = tallySession({
    keyed: true,
    players,
    order,
    answers: [
      { playerId: 'a', cardId: 'c1', correct: true },
      { playerId: 'a', cardId: 'c1', correct: false },
      { playerId: 'a', cardId: 'c2', correct: true },
      { playerId: 'a', cardId: 'c3', correct: null },
      { playerId: 'b', cardId: 'c1', correct: true },
      { playerId: 'b', cardId: 'c2', correct: true },
      { playerId: 'host', cardId: 'c1', correct: false },
      { playerId: 'demo', cardId: 'c2', correct: false },
    ],
  })

  assert.equal(tally.matched, 3)
  assert.equal(tally.differed, 1)
  assert.equal(tally.pending, 1)
  assert.equal(tally.covered, 2)
  const annStatus = tally.people.find((person) => person.name === '陳可恩')
  const lamStatus = tally.people.find((person) => person.name === '林子朗')
  assert.equal(annStatus && personStatus(annStatus, 3), 'follow')
  assert.equal(lamStatus && personStatus(lamStatus, 3), 'open')
  assert.equal(lamStatus && personStatus({ ...lamStatus, matched: 3, differed: 0, pending: 0 }, 3), 'done')
  assert.equal(tallyRate(tally), 0.75)
  assert.deepEqual(tally.people.map((person) => person.name).sort(), ['林子朗', '陳可恩'])
  const ann = tally.people.find((person) => person.name === '陳可恩')
  const lam = tally.people.find((person) => person.name === '林子朗')
  assert.deepEqual([ann?.matched, ann?.differed, ann?.pending], [1, 1, 1])
  assert.deepEqual([lam?.matched, lam?.differed, lam?.pending], [2, 0, 0])
  assert.deepEqual(tally.cards, [{ cardId: 'c1', number: 1, matched: 1, differed: 1 }])
})

test('without a reference key there is nothing to add up', () => {
  const tally = tallySession({
    keyed: false,
    players,
    order,
    answers: [{ playerId: 'a', cardId: 'c1', correct: true }],
  })
  assert.equal(tally.keyed, false)
  assert.equal(tally.matched, 0)
  assert.equal(tallyRate(tally), null)
})
