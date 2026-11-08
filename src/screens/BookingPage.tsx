import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { bookingApi } from '@/booking/api'
import { defaultStartValue, formatWhen } from '@/booking/format'
import { bookingMessage } from '@/booking/messages'
import { parseBookingName, parseContact, parseStartsAt } from '@/booking/rules'
import type { PublicSlot, PublicTeacher } from '@/booking/types'
import { BrandMark } from '@/components/BrandMark'
import { FreeNote } from '@/components/FreeNote'
import { Frame } from '@/components/Frame'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLang } from '@/i18n/lang'
import { withBase } from '@/lib/base'
import { usePageTitle } from '@/lib/title'

export function BookingPage() {
  const { lang, tx } = useLang()
  const [params] = useSearchParams()
  const [teachers, setTeachers] = useState<PublicTeacher[]>([])
  const [slots, setSlots] = useState<PublicSlot[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  usePageTitle(tx('信念遊戲 · 預約場次', 'Belief Game · Book a session'))

  async function reload() {
    const result = await bookingApi.listBoard()
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    setTeachers(result.board.teachers)
    setSlots(result.board.slots)
  }

  useEffect(() => {
    let active = true
    void bookingApi.listBoard().then((result) => {
      if (!active) return
      setLoading(false)
      if (!result.ok) setError(result.error)
      else {
        setTeachers(result.board.teachers)
        setSlots(result.board.slots)
      }
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (params.get('focus') !== 'one') return
    document.getElementById('one-on-one')?.scrollIntoView({ block: 'start' })
  }, [params])

  return (
    <Frame width="host">
      <main id="main">
        <div className="flex items-start justify-between gap-4">
          <BrandMark kicker="Book" />
          <Link to="/" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
            {tx('學員入口', 'Student entrance')}
          </Link>
        </div>
        <h1 className="mt-10 text-[1.85rem] font-medium leading-snug">{tx('預約場次', 'Book a session')}</h1>
        <div className="mt-3 max-w-xl">
          <FreeNote />
        </div>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          {tx(
            '可以選擇小組場次，或在小組之後預約一對一。加入房間不需要密碼。',
            'Choose a group session, or book a one-on-one after the group. Joining a room does not need a password.',
          )}
        </p>
        {error ? (
          <p className="mt-4 text-sm text-ink" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? <p className="mt-6 text-sm text-muted">{tx('正在讀取場次。', 'Loading sessions.')}</p> : null}

        <section className="mt-8" aria-labelledby="group-sessions">
          <h2 id="group-sessions" className="text-lg font-medium">
            {tx('小組場次', 'Group sessions')}
          </h2>
          {slots.length === 0 && !loading ? (
            <p className="mt-3 text-sm text-muted">{tx('尚無已開放的場次。', 'No sessions are open yet.')}</p>
          ) : (
            <div className="mt-4 grid gap-4">
              {slots.map((slot) => (
                <GroupSlot key={slot.id} slot={slot} lang={lang} onJoined={() => void reload()} />
              ))}
            </div>
          )}
        </section>

        <section id="one-on-one" className="mt-10 scroll-mt-6" aria-labelledby="one-title">
          <h2 id="one-title" className="text-lg font-medium">
            {tx('一對一對話', 'One-on-one')}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            {tx(
              '小組之後，如希望繼續，可以向導師預約一對一。現時可預約 Andy。其後可加入更多導師。',
              'After a group session, you can book a one-on-one with a teacher. Andy is available now. More teachers can be added later.',
            )}
          </p>
          {teachers.length === 0 && !loading ? (
            <p className="mt-3 text-sm text-muted">{tx('暫時沒有可預約的導師。', 'No teachers are open for booking yet.')}</p>
          ) : (
            <OneOnOneForm teachers={teachers} />
          )}
        </section>

        <p className="mt-8">
          <Link to="/host" className="text-sm text-muted underline decoration-line underline-offset-4">
            {tx('我是主持', 'I am the host')}
          </Link>
        </p>
      </main>
    </Frame>
  )
}

function GroupSlot({ slot, lang, onJoined }: { slot: PublicSlot; lang: 'zh' | 'en'; onJoined: () => void }) {
  const { tx } = useLang()
  const nameId = useId()
  const contactId = useId()
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<'new' | 'already' | null>(null)
  const [pending, setPending] = useState(false)
  const closed = slot.status !== 'open' || slot.bookedCount >= slot.capacity
  const status = slot.status === 'full' || slot.bookedCount >= slot.capacity ? tx('名額已滿', 'Full') : tx('接受登記', 'Open')
  const joinPath = slot.roomCode ? withBase(`/r/${slot.roomCode}`) : ''

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const parsedName = parseBookingName(name)
    const parsedContact = parseContact(contact)
    if (!parsedName.ok) return setError(bookingMessage(parsedName.error))
    if (!parsedContact.ok) return setError(bookingMessage(parsedContact.error))
    setPending(true)
    setError(null)
    const result = await bookingApi.joinSlot({ slotId: slot.id, name: parsedName.name, contact: parsedContact.contact })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDone(result.already ? 'already' : 'new')
    onJoined()
  }

  return (
    <Panel className="px-6 py-5">
      <h3 className="text-base font-medium">{formatWhen(slot.startsAt, lang)}</h3>
      <p className="mt-1 text-sm text-muted">
        {slot.hostLabel ? `${slot.hostLabel} · ` : ''}
        {tx(`${slot.bookedCount} / ${slot.capacity} 人`, `${slot.bookedCount} / ${slot.capacity} people`)}
        {' · '}
        {status}
      </p>
      {joinPath ? (
        <p className="mt-3 text-sm">
          <Link to={`/r/${slot.roomCode}`} className="text-ink underline decoration-line underline-offset-4">
            {tx('進入房間（無需密碼）', 'Enter the room (no password)')}
          </Link>
        </p>
      ) : null}
      {done ? (
        <p className="mt-3 text-sm text-ink" role="status">
          {done === 'already'
            ? tx('你已登記這場。', 'You are already registered for this session.')
            : tx('已登記。遊戲開始時，請用加入連結進入，無需密碼，亦無需預先付款。', 'You are registered. When the game starts, use the join link. No password and no payment first.')}
        </p>
      ) : closed ? null : (
        <form className="mt-4 grid gap-3 sm:grid-cols-2" noValidate onSubmit={(event) => void onSubmit(event)}>
          <label className="block" htmlFor={nameId}>
            <span className="text-sm text-ink">{tx('你的名字', 'Your name')}</span>
            <Input id={nameId} className="mt-2" value={name} onChange={(event) => setName(event.target.value)} maxLength={32} required />
          </label>
          <label className="block" htmlFor={contactId}>
            <span className="text-sm text-ink">{tx('聯絡方式（可選）', 'Contact (optional)')}</span>
            <Input id={contactId} className="mt-2" value={contact} onChange={(event) => setContact(event.target.value)} maxLength={80} />
          </label>
          {error ? (
            <p className="text-sm text-ink sm:col-span-2" role="alert">
              {error}
            </p>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? tx('正在登記', 'Registering') : tx('登記參加', 'Register')}
            </Button>
          </div>
        </form>
      )}
    </Panel>
  )
}

function OneOnOneForm({ teachers }: { teachers: PublicTeacher[] }) {
  const { lang, tx } = useLang()
  const teacherIdDefault = teachers.length === 1 ? teachers[0].id : ''
  const [teacherId, setTeacherId] = useState(teacherIdDefault)
  const [startsAt, setStartsAt] = useState(defaultStartValue)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)
  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const parsedName = parseBookingName(name)
    const parsedContact = parseContact(contact)
    const when = parseStartsAt(startsAt)
    if (!teacherId) return setError(tx('請選擇導師。', 'Choose a teacher.'))
    if (!parsedName.ok) return setError(bookingMessage(parsedName.error))
    if (!parsedContact.ok) return setError(bookingMessage(parsedContact.error))
    if (!when.ok) return setError(bookingMessage(when.error))
    setPending(true)
    setError(null)
    const result = await bookingApi.bookOneOnOne({
      teacherId,
      startsAt: when.iso,
      name: parsedName.name,
      contact: parsedContact.contact,
    })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <p className="mt-4 text-sm text-ink" role="status">
        {contact.trim()
          ? tx('已登記一對一，無需預先付款。請保留你留下的聯絡方式，以便確認時間。', 'The one-on-one is registered. No payment is required first. Keep the contact you left so the time can be confirmed.')
          : tx('已登記一對一，無需預先付款。你未留下聯絡方式，導師可能無法確認時間。', 'The one-on-one is registered. No payment is required first. You left no contact, so the teacher may not be able to confirm the time.')}
      </p>
    )
  }

  return (
    <form className="mt-4 max-w-xl" noValidate onSubmit={(event) => void onSubmit(event)}>
      <fieldset>
        <legend className="text-sm text-ink">{tx('選擇導師', 'Choose a teacher')}</legend>
        <div className="mt-3 grid gap-3">
          {teachers.map((teacher) => (
            <label key={teacher.id} className="flex gap-3 rounded-[22px] border border-line bg-white px-4 py-4">
              <input
                type="radio"
                name="teacher"
                value={teacher.id}
                checked={teacherId === teacher.id}
                onChange={() => setTeacherId(teacher.id)}
              />
              <span>
                <span className="block text-[15px] text-ink">{teacher.name}</span>
                <span className="mt-1 block text-sm text-muted">{lang === 'en' ? teacher.summaryEn : teacher.summary}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-4 block" htmlFor="one-start">
        <span className="text-sm text-ink">{tx('希望的日期與時間', 'Preferred date and time')}</span>
        <Input id="one-start" className="mt-2" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
      </label>
      <label className="mt-4 block" htmlFor="one-name">
        <span className="text-sm text-ink">{tx('你的名字', 'Your name')}</span>
        <Input id="one-name" className="mt-2" value={name} onChange={(event) => setName(event.target.value)} maxLength={32} required />
      </label>
      <label className="mt-4 block" htmlFor="one-contact">
        <span className="text-sm text-ink">{tx('聯絡方式（可選）', 'Contact (optional)')}</span>
        <Input id="one-contact" className="mt-2" value={contact} onChange={(event) => setContact(event.target.value)} maxLength={80} />
      </label>
      {error ? (
        <p className="mt-4 text-sm text-ink" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="mt-4" type="submit" disabled={pending}>
        {pending ? tx('正在登記', 'Registering') : tx('預約一對一', 'Book a one-on-one')}
      </Button>
    </form>
  )
}
