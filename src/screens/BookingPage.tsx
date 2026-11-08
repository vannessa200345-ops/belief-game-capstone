import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { bookingApi } from '@/booking/api'
import { defaultStartValue, formatWhen } from '@/booking/format'
import { bookingMessage } from '@/booking/messages'
import { parseBookingName, parseContact, parseStartsAt } from '@/booking/rules'
import type { PublicSlot, PublicTeacher } from '@/booking/types'
import { BrandMark } from '@/components/BrandMark'
import { Frame } from '@/components/Frame'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ROOM_CAPACITY } from '@/domain/constants'
import { useLang } from '@/i18n/lang'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/lib/title'

const ONE_ON_ONE_HKD = 800

type Kind = 'group' | 'one'
type Step = 1 | 2 | 3

export function BookingPage() {
  const { lang, tx } = useLang()
  const [params] = useSearchParams()
  const focusOne = params.get('focus') === 'one'
  const [teachers, setTeachers] = useState<PublicTeacher[]>([])
  const [slots, setSlots] = useState<PublicSlot[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<Kind | null>(focusOne ? 'one' : null)
  const [step, setStep] = useState<Step>(focusOne ? 2 : 1)
  const [teacherId, setTeacherId] = useState('')
  const [slotId, setSlotId] = useState('')
  const [startsAt, setStartsAt] = useState(defaultStartValue)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState<{ kind: Kind; teacherName: string; when: string; join: string | null } | null>(null)
  usePageTitle(tx('信念遊戲 · 預約場次', 'Belief Game · Book a session'))

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

  const teacher = teachers.find((item) => item.id === teacherId) ?? null
  const slot = slots.find((item) => item.id === slotId) ?? null
  const openSlots = slots.filter((item) => item.status === 'open' && item.bookedCount < item.capacity)

  function chooseKind(next: Kind) {
    setKind(next)
    setTeacherId('')
    setSlotId('')
    setError(null)
    setStep(2)
  }

  function chooseTeacher(next: PublicTeacher) {
    if (!next.bookable) return
    setTeacherId(next.id)
    setSlotId('')
    setError(null)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!kind || !teacher || !teacher.bookable) return
    const parsedName = parseBookingName(name)
    const parsedContact = parseContact(contact)
    if (!parsedName.ok) return setError(bookingMessage(parsedName.error))
    if (!parsedContact.ok) return setError(bookingMessage(parsedContact.error))
    setPending(true)
    setError(null)
    if (kind === 'group') {
      if (!slot) {
        setPending(false)
        setError(tx('請選擇一個場次。', 'Choose a session.'))
        return
      }
      const result = await bookingApi.joinSlot({ slotId: slot.id, name: parsedName.name, contact: parsedContact.contact })
      setPending(false)
      if (!result.ok) return setError(result.error)
      setDone({
        kind,
        teacherName: slot.hostLabel ?? teacher.name,
        when: formatWhen(slot.startsAt, lang),
        join: slot.roomCode,
      })
      return
    }
    const when = parseStartsAt(startsAt)
    if (!when.ok) {
      setPending(false)
      return setError(bookingMessage(when.error))
    }
    const result = await bookingApi.bookOneOnOne({
      teacherId: teacher.id,
      startsAt: when.iso,
      name: parsedName.name,
      contact: parsedContact.contact,
    })
    setPending(false)
    if (!result.ok) return setError(result.error)
    setDone({
      kind,
      teacherName: teacher.name,
      when: formatWhen(when.iso, lang),
      join: null,
    })
  }

  return (
    <Frame width="host">
      <main id="main">
        <div className="flex items-start justify-between gap-4">
          <BrandMark kicker="預約" />
          <Link to="/" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
            {tx('前往進入房間', 'Go to enter a room')}
          </Link>
        </div>
        <p className="mt-8 text-sm text-muted">{tx('預約', 'Booking')}</p>
        <h1 className="mt-2 text-[1.85rem] font-medium leading-snug">{tx('預約場次', 'Book a session')}</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          {tx(
            '此頁只供預約小組場次或一對一。進入進行中的房間，請使用另一頁的房間碼或加入連結。',
            'This page is only for booking a group session or a one-on-one. To enter a live room, use the room code or join link on the separate enter page.',
          )}
        </p>

        {done ? (
          <Confirmation done={done} contact={contact.trim()} />
        ) : (
          <>
            <ol className="mt-8 flex flex-wrap gap-6 text-sm" aria-label={tx('預約步驟', 'Booking steps')}>
              <StepMark n={1} current={step} label={tx('形式', 'Format')} />
              <StepMark n={2} current={step} label={tx('導師', 'Teacher')} />
              <StepMark n={3} current={step} label={tx('時間', 'Time')} />
            </ol>

            {error ? (
              <p className="mt-6 text-sm text-ink" role="alert">
                {error}
              </p>
            ) : null}
            {loading ? <p className="mt-8 text-sm text-muted">{tx('正在讀取場次。', 'Loading sessions.')}</p> : null}

            {step === 1 ? (
              <section className="mt-10" aria-labelledby="pick-format">
                <h2 id="pick-format" className="text-lg font-medium">{tx('選擇形式', 'Choose a format')}</h2>
                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <ServiceCard
                    title={tx('小組場次', 'Group session')}
                    price={tx('免費', 'Free')}
                    detail={tx('歡迎捐款。無需預先付款。', 'Donations are welcome. Payment is not required first.')}
                    meta={tx(`人數上限由主持設定，不多於 ${ROOM_CAPACITY} 人。`, `The host sets the limit, at most ${ROOM_CAPACITY} people.`)}
                    pressed={kind === 'group'}
                    onClick={() => chooseKind('group')}
                  />
                  <ServiceCard
                    title={tx('一對一對話', 'One-on-one')}
                    price={`HKD ${ONE_ON_ONE_HKD}`}
                    detail={tx('約一小時。本頁只作登記，不在此收款。', 'About one hour. This page registers the time and does not take payment.')}
                    meta={tx('現時可選 Andy。', 'Andy is available now.')}
                    pressed={kind === 'one'}
                    onClick={() => chooseKind('one')}
                  />
                </div>
              </section>
            ) : null}

            {step === 2 ? (
              <section className="mt-10" aria-labelledby="pick-host">
                <h2 id="pick-host" className="text-lg font-medium">{tx('選擇導師', 'Choose a teacher')}</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {teachers.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!item.bookable}
                      aria-pressed={teacherId === item.id}
                      onClick={() => chooseTeacher(item)}
                      className={cn(
                        'rounded-[28px] border px-6 py-6 text-left',
                        teacherId === item.id ? 'border-pink bg-blush' : 'border-line bg-white',
                        item.bookable ? '' : 'cursor-not-allowed opacity-70',
                      )}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-lg text-ink">{item.name}</span>
                        {item.bookable ? null : (
                          <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">{tx('稍後開放', 'Opens later')}</span>
                        )}
                      </span>
                      <span className="mt-3 block text-sm leading-relaxed text-muted">
                        {lang === 'en' ? item.summaryEn : item.summary}
                      </span>
                    </button>
                  ))}
                </div>
                {teachers.length === 0 && !loading ? (
                  <p className="mt-4 text-sm text-muted">{tx('暫時沒有可顯示的導師。', 'No teachers to show yet.')}</p>
                ) : null}
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button variant="ghost" onClick={() => setStep(1)}>{tx('返回', 'Back')}</Button>
                  <Button size="lg" disabled={!teacher?.bookable} onClick={() => setStep(3)}>
                    {tx('下一步：選擇時間', 'Next: choose a time')}
                  </Button>
                </div>
              </section>
            ) : null}

            {step === 3 && kind && teacher ? (
              <section className="mt-10" aria-labelledby="pick-time">
                <h2 id="pick-time" className="text-lg font-medium">
                  {tx(`與 ${teacher.name} 選擇時間`, `Choose a time with ${teacher.name}`)}
                </h2>
                <form className="mt-6 max-w-xl" noValidate onSubmit={(event) => void submit(event)}>
                  {kind === 'group' ? (
                    <fieldset>
                      <legend className="text-sm text-ink">{tx('已開放的小組場次', 'Open group sessions')}</legend>
                      {openSlots.length === 0 ? (
                        <p className="mt-3 text-sm text-muted">{tx('尚無已開放的場次。', 'No sessions are open yet.')}</p>
                      ) : (
                        <div className="mt-4 grid gap-3">
                          {openSlots.map((item) => (
                            <label key={item.id} className={cn('rounded-[22px] border px-4 py-4', slotId === item.id ? 'border-pink bg-blush' : 'border-line bg-white')}>
                              <span className="flex items-start gap-3">
                                <input type="radio" name="slot" value={item.id} checked={slotId === item.id} onChange={() => setSlotId(item.id)} />
                                <span>
                                  <span className="block text-ink">{formatWhen(item.startsAt, lang)}</span>
                                  <span className="mt-1 block text-sm text-muted">
                                    {item.hostLabel ? `${item.hostLabel} · ` : ''}
                                    {tx(`${item.bookedCount}／${item.capacity} 人`, `${item.bookedCount}/${item.capacity} people`)}
                                  </span>
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </fieldset>
                  ) : (
                    <label className="block" htmlFor="one-start">
                      <span className="text-sm text-ink">{tx('希望的日期與時間', 'Preferred date and time')}</span>
                      <Input id="one-start" className="mt-2" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
                      <span className="mt-2 block text-sm text-muted">{tx(`約一小時 · HKD ${ONE_ON_ONE_HKD}`, `About one hour · HKD ${ONE_ON_ONE_HKD}`)}</span>
                    </label>
                  )}
                  <label className="mt-6 block" htmlFor="book-name">
                    <span className="text-sm text-ink">{tx('你的名字', 'Your name')}</span>
                    <Input id="book-name" className="mt-2" value={name} onChange={(event) => setName(event.target.value)} maxLength={32} required />
                  </label>
                  <label className="mt-4 block" htmlFor="book-contact">
                    <span className="text-sm text-ink">{tx('聯絡方式（可選）', 'Contact (optional)')}</span>
                    <Input id="book-contact" className="mt-2" value={contact} onChange={(event) => setContact(event.target.value)} maxLength={80} />
                  </label>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Button variant="ghost" type="button" onClick={() => setStep(2)}>{tx('返回', 'Back')}</Button>
                    <Button size="lg" type="submit" disabled={pending || (kind === 'group' && openSlots.length === 0)}>
                      {pending
                        ? tx('正在登記', 'Registering')
                        : kind === 'group'
                          ? tx('確認登記', 'Confirm registration')
                          : tx(`確認預約 · HKD ${ONE_ON_ONE_HKD}`, `Confirm · HKD ${ONE_ON_ONE_HKD}`)}
                    </Button>
                  </div>
                </form>
              </section>
            ) : null}
          </>
        )}

        <p className="mt-10">
          <Link to="/host" className="text-sm text-muted underline decoration-line underline-offset-4">
            {tx('我是主持', 'I am the host')}
          </Link>
        </p>
      </main>
    </Frame>
  )
}

function ServiceCard({
  title,
  price,
  detail,
  meta,
  pressed,
  onClick,
}: {
  title: string
  price: string
  detail: string
  meta: string
  pressed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'rounded-[28px] border px-6 py-8 text-left',
        pressed ? 'border-pink bg-blush' : 'border-line bg-white',
      )}
    >
      <span className="block text-sm text-muted">{title}</span>
      <span className="mt-3 block font-latin text-3xl text-ink">{price}</span>
      <span className="mt-4 block text-sm leading-relaxed text-ink">{detail}</span>
      <span className="mt-2 block text-sm leading-relaxed text-muted">{meta}</span>
    </button>
  )
}

function StepMark({ n, current, label }: { n: Step; current: Step; label: string }) {
  const active = current === n
  return (
    <li className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
      <span className={cn('flex size-7 items-center justify-center rounded-full font-latin text-sm', active ? 'bg-pink text-ink' : 'bg-line text-muted')}>{n}</span>
      <span className={active ? 'text-ink' : 'text-muted'}>{label}</span>
    </li>
  )
}

function Confirmation({
  done,
  contact,
}: {
  done: { kind: Kind; teacherName: string; when: string; join: string | null }
  contact: string
}) {
  const { tx } = useLang()
  return (
    <Panel className="mt-10 max-w-xl px-6 py-8" role="status">
      <h2 className="text-lg font-medium">{tx('已為你登記', 'You are registered')}</h2>
      <p className="mt-3 text-sm text-muted">
        {done.teacherName} · {done.when}
      </p>
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-ink">
        {done.kind === 'group' ? (
          <>
            <li>{tx('小組場次免費參加，歡迎捐款。無需預先付款。', 'The group session is free to join. Donations are welcome. Payment is not required first.')}</li>
            <li>
              {done.join
                ? tx(`遊戲開始時，請到「進入房間」頁，使用房間碼 ${done.join}。本頁不代為進入。`, `When the game starts, open the enter-room page and use room code ${done.join}. This page does not enter the room for you.`)
                : tx('遊戲開始時，請到「進入房間」頁，使用主持提供的房間碼或加入連結。', 'When the game starts, open the enter-room page and use the room code or join link from the host.')}
            </li>
            <li>{tx('請按時出席。名額以登記為準。', 'Please arrive at the scheduled time. Your place follows this registration.')}</li>
          </>
        ) : (
          <>
            <li>{tx(`一對一約一小時，費用 HKD ${ONE_ON_ONE_HKD}。`, `The one-on-one is about one hour and costs HKD ${ONE_ON_ONE_HKD}.`)}</li>
            <li>{tx('本頁不收款。請與導師確認付款方式。', 'This page does not take payment. Confirm payment with the teacher.')}</li>
            <li>
              {contact
                ? tx('請保留你留下的聯絡方式，以便確認時間。', 'Keep the contact you left so the time can be confirmed.')
                : tx('你未留下聯絡方式，導師可能無法確認時間。', 'You left no contact, so the teacher may not be able to confirm the time.')}
            </li>
          </>
        )}
      </ol>
      <p className="mt-6 text-sm">
        <Link to={done.join ? `/r/${done.join}` : '/'} className="text-ink underline decoration-line underline-offset-4">
          {tx('稍後前往進入房間頁', 'Later, open the enter-room page')}
        </Link>
      </p>
    </Panel>
  )
}
