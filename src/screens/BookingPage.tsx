import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { bookingApi } from '@/booking/api'
import { formatWhen } from '@/booking/format'
import { bookingMessage } from '@/booking/messages'
import { filterPublicSlots } from '@/booking/publicSlots'
import { parseBookingName, parseContact } from '@/booking/rules'
import type { PublicSlot, PublicTeacher, SlotKind } from '@/booking/types'
import { AndyPublicFacts } from '@/components/AndyPublicFacts'
import { PublicNav } from '@/components/PublicNav'
import { Frame } from '@/components/Frame'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState<{
    kind: Kind
    teacherName: string
    modality: string
    modalityEn: string
    when: string
    join: string | null
  } | null>(null)
  usePageTitle(tx('信念遊戲 · 預約場次', 'Belief Game · Book a session'))

  useEffect(() => {
    let active = true
    async function load() {
      const result = await bookingApi.listBoard()
      if (!active) return
      setLoading(false)
      if (!result.ok) setError(result.error)
      else {
        setTeachers(result.board.teachers)
        setSlots(result.board.slots)
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 8000)
    function onVisible() {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const offeredTeachers = teachers.filter((item) => item.bookable)
  const pickedTeacher = offeredTeachers.find((item) => item.id === teacherId) ?? null
  const onlyTeacher = offeredTeachers.length === 1 ? offeredTeachers[0] : null
  const teacher = pickedTeacher ?? onlyTeacher
  const slotKind: SlotKind = kind === 'one' ? 'one_on_one' : 'group'
  const slot = slots.find((item) => item.id === slotId) ?? null
  const openSlots = teacher ? filterPublicSlots(slots, teachers, slotKind, teacher.id) : []

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
    if (!slot || slot.kind !== slotKind) {
      setPending(false)
      setError(tx('請選擇一個已開放的時段。', 'Choose an open session.'))
      return
    }
    const result =
      kind === 'group'
        ? await bookingApi.joinSlot({ slotId: slot.id, name: parsedName.name, contact: parsedContact.contact })
        : await bookingApi.bookOneOnOne({ slotId: slot.id, name: parsedName.name, contact: parsedContact.contact })
    setPending(false)
    if (!result.ok) return setError(result.error)
    setDone({
      kind,
      teacherName: slot.hostLabel ?? teacher.name,
      modality: teacher.summary,
      modalityEn: teacher.summaryEn,
      when: formatWhen(slot.startsAt, lang),
      join: kind === 'group' ? slot.roomCode : null,
    })
  }

  return (
    <>
      <PublicNav />
      <Frame width="host">
      <main id="main">
        <p className="text-sm text-muted">{tx('預約', 'Booking')}</p>
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
                    price={tx('隨緣樂助', 'Give as you wish')}
                    detail={tx('無需預先付款。金額由你決定，不是預購門票。', 'No advance payment. The amount is yours to decide. This is not a prepaid ticket.')}
                    meta={tx('登記完成後，遊戲開始時再到進入房間頁。', 'After you register, use the enter-room page when the game starts.')}
                    pressed={kind === 'group'}
                    onClick={() => chooseKind('group')}
                  />
                  <ServiceCard
                    title={tx('一對一', 'One-on-one')}
                    price={`HKD ${ONE_ON_ONE_HKD}`}
                    detail={tx('約一小時。只可選導師已開放的時段。本頁只作登記，不在此收款。', 'About one hour. Choose an hour the teacher has opened. This page registers the time and does not take payment.')}
                    meta={tx('現時可選 Andy（希塔療癒）。', 'Andy (Theta Healing) can be chosen now.')}
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
                  {offeredTeachers.map((item) => (
                    <TeacherOption
                      key={item.id}
                      teacher={item}
                      selected={teacher?.id === item.id}
                      onSelect={() => chooseTeacher(item)}
                    />
                  ))}
                </div>
                {offeredTeachers.length === 0 && !loading ? (
                  <p className="mt-4 text-sm text-muted">{tx('暫時沒有可預約的導師。', 'No teachers are open for booking yet.')}</p>
                ) : null}
                {!teacher && offeredTeachers.length > 0 ? (
                  <p id="teacher-required" className="mt-4 text-sm text-ink">
                    {tx('請先選擇一位導師。', 'Choose a teacher first.')}
                  </p>
                ) : null}
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button variant="ghost" onClick={() => setStep(1)}>{tx('返回', 'Back')}</Button>
                  <Button
                    size="lg"
                    disabled={!teacher?.bookable}
                    aria-describedby={!teacher && offeredTeachers.length > 0 ? 'teacher-required' : undefined}
                    onClick={() => {
                      if (!teacher?.bookable) return
                      if (teacherId !== teacher.id) {
                        setTeacherId(teacher.id)
                        setSlotId('')
                      }
                      setStep(3)
                    }}
                  >
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
                  <fieldset>
                    <legend className="text-sm text-ink">
                      {kind === 'group' ? tx('已開放的小組場次', 'Open group sessions') : tx('已開放的一對一時段', 'Open one-on-one hours')}
                    </legend>
                    {openSlots.length === 0 ? (
                      <p className="mt-3 text-sm text-muted">{tx('尚無已開放的時段。', 'No sessions are open yet.')}</p>
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
                                  {kind === 'group'
                                    ? tx(`已登記 ${item.bookedCount} 人`, `${item.bookedCount} registered`)
                                    : tx(`一小時 · HKD ${ONE_ON_ONE_HKD}`, `One hour · HKD ${ONE_ON_ONE_HKD}`)}
                                </span>
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </fieldset>
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
                    <Button size="lg" type="submit" disabled={pending || openSlots.length === 0 || !slot}>
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
    </>
  )
}

function TeacherOption({
  teacher,
  selected,
  onSelect,
}: {
  teacher: PublicTeacher
  selected: boolean
  onSelect: () => void
}) {
  const { lang, tx } = useLang()
  return (
    <div
      className={cn(
        'cursor-pointer rounded-[28px] border px-6 py-6 text-left focus-within:ring-2 focus-within:ring-lavender',
        selected ? 'border-pink bg-blush' : 'border-line bg-white hover:border-pink',
      )}
      onClick={onSelect}
    >
      <button
        type="button"
        className="w-full text-left focus-visible:outline-none"
        aria-pressed={selected}
        onClick={(event) => {
          event.stopPropagation()
          onSelect()
        }}
      >
        <span className="flex items-start justify-between gap-3">
          <span className="text-lg text-ink">{teacher.name}</span>
          <span className={cn('shrink-0 rounded-full px-3 py-1 text-sm', selected ? 'bg-pink text-ink' : 'text-muted')}>
            {selected ? tx('已選擇', 'Selected') : tx('按此選擇', 'Choose')}
          </span>
        </span>
        <span className="mt-3 block text-sm leading-relaxed text-muted">
          {lang === 'en' ? teacher.summaryEn : teacher.summary}
        </span>
      </button>
      {teacher.slug === 'andy' ? (
        <div className="mt-4">
          <AndyPublicFacts />
        </div>
      ) : null}
    </div>
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
      <span className="block text-3xl text-ink">{title}</span>
      <span className="mt-3 block text-sm text-muted">{price}</span>
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
  done: { kind: Kind; teacherName: string; modality: string; modalityEn: string; when: string; join: string | null }
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
            <li>{tx('小組場次為隨緣樂助，無需預先付款。', 'The group session is give as you wish. No advance payment is required.')}</li>
            <li>
              {done.join
                ? tx(`遊戲開始時，請到「進入房間」頁，使用房間碼 ${done.join}。本頁不代為進入。`, `When the game starts, open the enter-room page and use room code ${done.join}. This page does not enter the room for you.`)
                : tx('遊戲開始時，請到「進入房間」頁，使用主持提供的房間碼或加入連結。', 'When the game starts, open the enter-room page and use the room code or join link from the host.')}
            </li>
            <li>{tx('請按時出席。名額以登記為準。', 'Please arrive at the scheduled time. Your place follows this registration.')}</li>
          </>
        ) : (
          <>
            <li>
              {tx(
                `與 ${done.teacherName} 的一對一約一小時，費用 HKD ${ONE_ON_ONE_HKD}。${done.modality}`,
                `The one-on-one with ${done.teacherName} is about one hour and costs HKD ${ONE_ON_ONE_HKD}. ${done.modalityEn}`,
              )}
            </li>
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
