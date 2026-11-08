import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseBookingName,
  parseCapacity,
  parseClaimToken,
  parseContact,
  parseHostLabel,
  parseHostPin,
  parseRoomCode,
  parseStartsAt,
} from '../src/booking/rules.ts'

const now = Date.parse('2026-11-08T02:00:00.000Z')

test('host pin is six digits', () => {
  assert.equal(parseHostPin('123456').ok, true)
  assert.equal(parseHostPin(' 123456 ').ok, true)
  assert.equal(parseHostPin('12345').ok, false)
  assert.equal(parseHostPin('1234567').ok, false)
  assert.equal(parseHostPin('12a456').ok, false)
})

test('a booking session stores at most 200 registrations', () => {
  assert.deepEqual(parseCapacity('200'), { ok: true, capacity: 200 })
  assert.deepEqual(parseCapacity('1'), { ok: true, capacity: 1 })
  assert.equal(parseCapacity('0').ok, false)
  assert.equal(parseCapacity('201').ok, false)
  assert.equal(parseCapacity('').ok, false)
  assert.equal(parseCapacity('20.5').ok, false)
})

test('room code is optional and normalised', () => {
  assert.deepEqual(parseRoomCode(''), { ok: true, code: null })
  assert.deepEqual(parseRoomCode(' ab12 '), { ok: true, code: 'AB12' })
  assert.equal(parseRoomCode('A').ok, false)
  assert.equal(parseRoomCode('ABCDEFGHI').ok, false)
})

test('start time must be in range', () => {
  assert.equal(parseStartsAt('2026-11-08T02:30:00.000Z', now).ok, true)
  assert.equal(parseStartsAt('2026-11-08T01:00:00.000Z', now).ok, false)
  assert.equal(parseStartsAt('2030-01-01T00:00:00.000Z', now).ok, false)
  assert.equal(parseStartsAt('not-a-date', now).ok, false)
})

test('labels, names, contacts, and claim codes', () => {
  assert.deepEqual(parseHostLabel(''), { ok: true, label: null })
  assert.equal(parseHostLabel('a'.repeat(33)).ok, false)
  assert.equal(parseBookingName('').ok, false)
  assert.equal(parseBookingName('陳可恩').ok, true)
  assert.deepEqual(parseContact(''), { ok: true, contact: null })
  assert.equal(parseContact('x'.repeat(81)).ok, false)
  assert.equal(parseClaimToken('ABCD EFGH ABCD EFGH ABCD EFGH ABCD EFGH'.replace(/ /g, '')).ok, false)
  assert.equal(parseClaimToken('ab'.repeat(16)).ok, true)
  assert.equal(parseClaimToken('AB'.repeat(16)).ok, true)
})
