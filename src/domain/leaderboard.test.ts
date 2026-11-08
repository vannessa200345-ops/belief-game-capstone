import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { selectLeaderboard, roomCorrectCounts, type PaceGrade } from './selectors.ts'
import type { GameState } from './types.ts'

function state(partial: Partial<GameState> & Pick<GameState, 'players' | 'answers' | 'youId'>): GameState {
  return {
    room: {
      code: 'ROOM',
      deck: 'core',
      phase: 'final',
      cardIndex: 0,
      roundStartedAt: null,
      createdAt: 0,
    },
    timeouts: [],
    queue: [],
    called: null,
    botPlans: [],
    notices: [],
    notes: [],
    connection: 'live',
    selfPaceLink: 'live',
    remoteAnswered: {},
    serverAnswerCount: 0,
    remoteCorrect: {},
    scoresReady: true,
    music: null,
    ...partial,
  }
}

describe('player ranking matches the host ranking', () => {
  it('shows the same scores and ranks from the host counts, not zeros for everyone else', () => {
    const players = [
      { id: 'host', name: '主持', demo: false, joinedAt: 0, connected: true, host: true },
      { id: 'vvv', name: 'Vvv', demo: false, joinedAt: 1, connected: true, host: false },
      { id: 'andrea', name: 'Andrea', demo: false, joinedAt: 2, connected: true, host: false },
      { id: 'helen', name: 'Helen', demo: false, joinedAt: 3, connected: true, host: false },
    ]
    const answers = [
      { playerId: 'vvv', cardId: 'core-1', optionId: 'yes', ms: 1000, correct: true },
      { playerId: 'vvv', cardId: 'core-2', optionId: 'no', ms: 1000, correct: true },
      { playerId: 'andrea', cardId: 'core-1', optionId: 'yes', ms: 1200, correct: true },
      { playerId: 'helen', cardId: 'core-3', optionId: 'no', ms: 900, correct: false },
    ]
    const host = state({ players, answers, youId: 'host' })
    const counts = roomCorrectCounts(host)
    const hostBoard = selectLeaderboard({ ...host, remoteCorrect: counts, scoresReady: true })

    const player = state({
      players,
      youId: 'vvv',
      answers: answers.filter((answer) => answer.playerId === 'vvv'),
      remoteCorrect: counts,
      scoresReady: true,
    })
    const playerBoard = selectLeaderboard(player)

    assert.deepEqual(
      playerBoard.rows.map((row) => [row.name, row.correct, row.rank]),
      hostBoard.rows.map((row) => [row.name, row.correct, row.rank]),
    )
    assert.deepEqual(
      playerBoard.rows.map((row) => [row.name, row.correct, row.rank]),
      [
        ['Vvv', 2, 1],
        ['Andrea', 1, 2],
        ['Helen', 0, 3],
      ],
    )
    assert.equal(playerBoard.pending, false)
    assert.equal(playerBoard.rows.some((row) => row.name === 'Andrea' && row.correct === 0), false)
  })

  it('does not paint other learners as zero before room scores arrive', () => {
    const hidden = state({
      players: [
        { id: 'host', name: '主持', demo: false, joinedAt: 0, connected: true, host: true },
        { id: 'vvv', name: 'Vvv', demo: false, joinedAt: 1, connected: true, host: false },
        { id: 'andrea', name: 'Andrea', demo: false, joinedAt: 2, connected: true, host: false },
      ],
      youId: 'vvv',
      answers: [{ playerId: 'vvv', cardId: 'core-1', optionId: 'yes', ms: 800, correct: true }],
      scoresReady: false,
      remoteCorrect: {},
    })
    const board = selectLeaderboard(hidden)
    assert.equal(board.pending, true)
    assert.deepEqual(
      board.rows.map((row) => row.name),
      ['Vvv'],
    )
    assert.equal(board.you?.correct, 1)
  })

  it('keeps the current player ahead when a local grade has not reached the room count yet', () => {
    const pace: PaceGrade[] = [
      { cardId: 'core-1', isCorrect: true },
      { cardId: 'core-2', isCorrect: true },
      { cardId: 'core-9', isCorrect: true },
    ]
    const board = selectLeaderboard(
      state({
        players: [
          { id: 'vvv', name: 'Vvv', demo: false, joinedAt: 1, connected: true, host: false },
          { id: 'andrea', name: 'Andrea', demo: false, joinedAt: 2, connected: true, host: false },
        ],
        youId: 'vvv',
        answers: [],
        remoteCorrect: { vvv: 2, andrea: 4 },
        scoresReady: true,
      }),
      pace,
    )
    const you = board.rows.find((row) => row.you)
    const andrea = board.rows.find((row) => row.name === 'Andrea')
    assert.equal(you?.correct, 3)
    assert.equal(andrea?.correct, 4)
    assert.equal(board.rows[0]?.name, 'Andrea')
  })
})
