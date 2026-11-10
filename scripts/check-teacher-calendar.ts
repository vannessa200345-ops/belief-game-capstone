import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { filterPublicSlots } from '../src/booking/publicSlots.ts'
import { parseEmail, parsePassword } from '../src/booking/rules.ts'
import { hktHourIso, hktParts, hktWeekday, parseSlotStart, rangesOverlap, startOfHktWeek } from '../src/booking/time.ts'
import type { PublicSlot, PublicTeacher } from '../src/booking/types.ts'

const now = Date.parse('2026-11-10T02:00:00.000Z')

const teachers: PublicTeacher[] = [
  {
    id: 'andy',
    slug: 'andy',
    name: 'Andy',
    summary: '希塔療癒。現時可預約。',
    summaryEn: 'Theta Healing. Available now.',
    bookable: true,
  },
  {
    id: 'vanessa',
    slug: 'vanessa',
    name: 'Vanessa',
    summary: 'Quantum healing。認證量子療癒師。',
    summaryEn: 'Quantum healing. Certified quantum practitioner.',
    bookable: false,
  },
]

function slot(partial: Pick<PublicSlot, 'id' | 'kind' | 'teacherId' | 'hostLabel' | 'capacity' | 'bookedCount' | 'status'>): PublicSlot {
  return {
    startsAt: '2026-11-11T11:00:00.000Z',
    roomCode: null,
    ...partial,
  }
}

test('a Hong Kong hour is stored in UTC and must start on the hour', () => {
  const evening = hktHourIso(2026, 11, 11, 19)
  const afternoon = hktHourIso(2026, 11, 14, 15)
  assert.equal(evening, '2026-11-11T11:00:00.000Z')
  assert.equal(afternoon, '2026-11-14T07:00:00.000Z')
  assert.equal(hktParts(new Date(evening))?.hour, 19)
  assert.equal(hktParts(new Date(afternoon))?.hour, 15)
  assert.equal(parseSlotStart(evening, now).ok, true)
  assert.equal(parseSlotStart('2026-11-11T11:30:00.000Z', now).ok, false)
  assert.equal(parseSlotStart('2026-11-08T11:00:00.000Z', now).ok, false)
})

test('the calendar week starts on Monday in Hong Kong', () => {
  const start = startOfHktWeek({ year: 2026, month: 11, day: 10 })
  assert.deepEqual(start, { year: 2026, month: 11, day: 9 })
  assert.equal(hktWeekday(start), 1)
})

test('adjacent hours do not overlap and the same hour does', () => {
  const earlier = Date.parse(hktHourIso(2026, 11, 11, 18))
  const later = Date.parse(hktHourIso(2026, 11, 11, 19))
  assert.equal(rangesOverlap(earlier, later), false)
  assert.equal(rangesOverlap(later, later), true)
  assert.equal(rangesOverlap(later, Date.parse('2026-11-11T11:30:00.000Z')), true)
})

test('public booking keeps group and one-on-one on separate lists', () => {
  const slots = [
    slot({ id: 'group-open', kind: 'group', teacherId: 'andy', hostLabel: 'Andy', capacity: 20, bookedCount: 0, status: 'open' }),
    slot({ id: 'group-full', kind: 'group', teacherId: 'andy', hostLabel: 'Andy', capacity: 20, bookedCount: 20, status: 'open' }),
    slot({ id: 'group-label', kind: 'group', teacherId: null, hostLabel: 'Andy', capacity: 20, bookedCount: 1, status: 'open' }),
    slot({ id: 'one-open', kind: 'one_on_one', teacherId: 'andy', hostLabel: 'Andy', capacity: 1, bookedCount: 0, status: 'open' }),
    slot({ id: 'one-taken', kind: 'one_on_one', teacherId: 'andy', hostLabel: 'Andy', capacity: 1, bookedCount: 1, status: 'full' }),
    slot({ id: 'vanessa', kind: 'group', teacherId: 'vanessa', hostLabel: 'Vanessa', capacity: 20, bookedCount: 0, status: 'open' }),
    slot({ id: 'closed', kind: 'group', teacherId: 'andy', hostLabel: 'Andy', capacity: 20, bookedCount: 0, status: 'started' }),
  ]
  assert.deepEqual(
    filterPublicSlots(slots, teachers, 'group', 'andy').map((item) => item.id),
    ['group-open', 'group-label'],
  )
  assert.deepEqual(
    filterPublicSlots(slots, teachers, 'one_on_one', 'andy').map((item) => item.id),
    ['one-open'],
  )
  assert.deepEqual(filterPublicSlots(slots, teachers, 'group', 'vanessa'), [])
  assert.deepEqual(filterPublicSlots(slots, teachers, 'one_on_one', 'vanessa'), [])
})

test('teacher login fields stay separate from a host PIN', () => {
  assert.equal(parseEmail(' Andy@Example.com ').ok, true)
  assert.equal(parseEmail('not-an-email').ok, false)
  assert.equal(parsePassword('123456').ok, false)
  assert.equal(parsePassword('12345678').ok, true)
})

test('the teacher migration does not rewrite the existing group rows', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261110120000_teacher_calendar.sql', import.meta.url), 'utf8')
  for (const id of [
    '4c2cfa7e-3453-4423-b140-2cf8d5fe0b5a',
    'dd7abde4-fb40-4632-a1de-69ef106162ae',
    'de0a62e7-b5bd-4fb4-b216-9eb9a331f42b',
  ]) {
    assert.match(sql, new RegExp(id))
    assert.equal(sql.includes(`'${id}'`), false)
  }
  assert.equal(/set\s+capacity\s*=\s*200/i.test(sql), false)
  assert.equal(/delete\s+from\s+public\.booking_slots/i.test(sql), false)
})
