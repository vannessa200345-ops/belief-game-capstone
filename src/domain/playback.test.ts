import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { bestClockOffset, musicPositionMs, nextMusic, sampleClock, startMusic } from './playback.ts'
import type { RoomMusic } from './types.ts'

describe('music timeline', () => {
  it('holds position until the shared start time, then advances together', () => {
    const music = startMusic('healing', 0, 1_000)
    assert.equal(music.anchorAt, 2_200)
    assert.equal(musicPositionMs(music, 1_500, null), 0)
    assert.equal(musicPositionMs(music, 2_200, null), 0)
    assert.equal(musicPositionMs(music, 3_700, null), 1_500)
  })

  it('seeks a late joiner to the current offset instead of restarting', () => {
    const music = startMusic('healing', 4_000, 1_000)
    assert.equal(musicPositionMs(music, 5_000, 10_000), 4_000 + (5_000 - 2_200))
    assert.equal(musicPositionMs(music, 5_000, 10_000) % 10_000, (4_000 + 2_800) % 10_000)
  })

  it('pauses on the shared offset and resumes from there', () => {
    const playing = startMusic('water-lily', 1_000, 0)
    const paused = nextMusic(playing, 'pause', playing.trackId, playing.anchorAt + 800)
    assert.ok(paused)
    assert.equal(paused.playing, false)
    assert.equal(paused.positionMs, 1_800)
    const resumed = nextMusic(paused, 'play', paused.trackId, 9_000)
    assert.ok(resumed)
    assert.equal(resumed.playing, true)
    assert.equal(resumed.positionMs, 1_800)
    assert.equal(musicPositionMs(resumed, 9_000, null), 1_800)
    assert.equal(musicPositionMs(resumed, resumed.anchorAt + 500, null), 2_300)
  })

  it('changing tracks restarts at the beginning for every device', () => {
    const playing: RoomMusic = { trackId: 'healing', playing: true, positionMs: 2_000, anchorAt: 0 }
    const next = nextMusic(playing, 'play', 'gymnopedie', 5_000)
    assert.ok(next)
    assert.equal(next.trackId, 'gymnopedie')
    assert.equal(next.positionMs, 0)
    assert.equal(musicPositionMs(next, 5_000, null), 0)
  })
})

describe('host clock offset', () => {
  it('uses the lowest-latency sample', () => {
    const noisy = sampleClock(0, 100, 110, 300)
    const clean = sampleClock(1_000, 1_040, 1_045, 1_090)
    assert.ok(noisy && clean)
    assert.equal(bestClockOffset([noisy, clean]), clean.offset)
    assert.equal(clean.offset, ((40 - 0) + (45 - 90)) / 2)
  })
})
