import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { bookingApi } from '@/booking/api'
import { formatWhen } from '@/booking/format'
import { bookingMessage } from '@/booking/messages'
import { parseEmail, parsePassword } from '@/booking/rules'
import {
  CALENDAR_END_HOUR,
  CALENDAR_START_HOUR,
  addHktDays,
  addHktMonths,
  formatHktDay,
  formatHktMonth,
  formatHourRange,
  hktHourIso,
  hktParts,
  hktToday,
  monthGrid,
  rangesOverlap,
  sameHktDate,
  startOfHktWeek,
  visibleRange,
  type HktDate,
} from '@/booking/time'
import type { PublicSlot, SlotBooking, SlotKind, TeacherAccount, TeacherDirectoryEntry } from '@/booking/types'
import { Frame } from '@/components/Frame'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLang } from '@/i18n/lang'
import { liveBackend } from '@/lib/env'
import { usePageTitle } from '@/lib/title'
import { cn } from '@/lib/utils'
import { adoptTeacherCallback, sendTeacherPasswordReset, signInWithTeacherPassword, updateTeacherPassword } from '@/teacher/auth'

type Phase = 'loading' | 'signed_out' | 'password' | 'unlinked' | 'ready'

export function TeacherPage() {
  const { lang, tx } = useLang()
  const today = hktToday()
  const [phase, setPhase] = useState<Phase>('loading')
  const [account, setAccount] = useState<TeacherAccount | null>(null)
  const [directory, setDirectory] = useState<TeacherDirectoryEntry[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [kind, setKind] = useState<SlotKind>('group')
  const [view, setView] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState<HktDate>(today)
  const [selected, setSelected] = useState<HktDate>(today)
  const [slots, setSlots] = useState<PublicSlot[]>([])
  const [otherSlots, setOtherSlots] = useState<PublicSlot[]>([])
  const [teacherFilter, setTeacherFilter] = useState('all')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [registrations, setRegistrations] = useState<{ slotId: string; rows: SlotBooking[] } | null>(null)
  usePageTitle(tx('信念遊戲 · 導師日曆', 'Belief Game · Teacher calendar'))

  useEffect(() => {
    let active = true
    void (async () => {
      let requirePassword = false
      try {
        if (liveBackend) {
          const callback = await adoptTeacherCallback()
          requirePassword = callback === 'invite' || callback === 'recovery'
        }
      } catch {
        if (!active) return
        setError(bookingMessage('unknown'))
      }
      const me = await bookingApi.teacherMe()
      if (!active) return
      if (!me.ok) {
        if (requirePassword && me.error === bookingMessage('teacher_not_linked')) {
          setPasswordRequired(true)
          setPhase('password')
          return
        }
        setPhase(me.error === bookingMessage('teacher_not_linked') ? 'unlinked' : 'signed_out')
        if (me.error === bookingMessage('teacher_not_linked')) setError(me.error)
        return
      }
      setAccount(me.teacher)
      setDirectory(me.directory)
      setPasswordRequired(requirePassword)
      setPhase(requirePassword ? 'password' : 'ready')
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (phase !== 'ready' || !account) return
    let active = true
    const range = visibleRange(view, anchor)
    const otherKind: SlotKind = kind === 'group' ? 'one_on_one' : 'group'
    void (async () => {
      const [current, other] = await Promise.all([
        bookingApi.teacherListSlots({ kind, from: range.from, to: range.to }),
        account.role === 'teacher'
          ? bookingApi.teacherListSlots({ kind: otherKind, from: range.from, to: range.to })
          : Promise.resolve({ ok: true as const, slots: [] as PublicSlot[] }),
      ])
      if (!active) return
      if (!current.ok) {
        setError(current.error)
        return
      }
      setSlots(current.slots)
      setOtherSlots(other.ok ? other.slots : [])
    })()
    return () => {
      active = false
    }
  }, [phase, account, kind, view, anchor])

  async function enter() {
    const parsedEmail = parseEmail(email)
    const parsedPassword = parsePassword(password)
    if (!parsedEmail.ok) return setError(bookingMessage(parsedEmail.error))
    if (!parsedPassword.ok) return setError(bookingMessage(parsedPassword.error))
    setPending(true)
    setError(null)
    const signed = await signInWithTeacherPassword(parsedEmail.email, parsedPassword.password)
    if (!signed.ok) {
      setPending(false)
      setError(signed.error)
      return
    }
    const me = await bookingApi.teacherMe()
    setPending(false)
    setPassword('')
    if (!me.ok) {
      setPhase(me.error === bookingMessage('teacher_not_linked') ? 'unlinked' : 'signed_out')
      setError(me.error)
      return
    }
    setAccount(me.teacher)
    setDirectory(me.directory)
    setPhase('ready')
  }

  async function preview(role: 'teacher' | 'operator') {
    setPending(true)
    setError(null)
    const started = await bookingApi.teacherPreview({ role })
    if (!started.ok) {
      setPending(false)
      setError(started.error)
      return
    }
    const me = await bookingApi.teacherMe()
    setPending(false)
    if (!me.ok) {
      setError(me.error)
      return
    }
    setAccount(me.teacher)
    setDirectory(me.directory)
    setPhase('ready')
  }

  async function savePassword() {
    const parsed = parsePassword(nextPassword)
    if (!parsed.ok) return setError(bookingMessage(parsed.error))
    setPending(true)
    setError(null)
    const saved = await updateTeacherPassword(parsed.password)
    setPending(false)
    if (!saved.ok) return setError(saved.error)
    setNextPassword('')
    setPasswordRequired(false)
    setNotice(tx('密碼已更新。', 'Password updated.'))
    if (!account) {
      const me = await bookingApi.teacherMe()
      if (!me.ok) {
        setPhase(me.error === bookingMessage('teacher_not_linked') ? 'unlinked' : 'signed_out')
        if (me.error === bookingMessage('teacher_not_linked')) setError(me.error)
        return
      }
      setAccount(me.teacher)
      setDirectory(me.directory)
    }
    setPhase('ready')
  }

  async function resetMail() {
    const parsedEmail = parseEmail(email)
    if (!parsedEmail.ok) return setError(bookingMessage(parsedEmail.error))
    setPending(true)
    setError(null)
    const sent = await sendTeacherPasswordReset(parsedEmail.email)
    setPending(false)
    if (!sent.ok) return setError(sent.error)
    setNotice(bookingMessage('recovery_sent'))
  }

  async function signOut() {
    await bookingApi.teacherSignOut()
    setAccount(null)
    setDirectory([])
    setSlots([])
    setOtherSlots([])
    setPhase('signed_out')
    setNotice(null)
    setError(null)
  }

  async function openHour(hour: number) {
    if (!account || account.role !== 'teacher') return
    setPending(true)
    setError(null)
    const result = await bookingApi.teacherOpenSlot({
      kind,
      startsAt: hktHourIso(selected.year, selected.month, selected.day, hour),
    })
    setPending(false)
    if (!result.ok) return setError(result.error)
    setSlots((current) => [...current, result.slot].sort((left, right) => left.startsAt.localeCompare(right.startsAt)))
  }

  async function closeSlot(slotId: string) {
    setPending(true)
    setError(null)
    const result = await bookingApi.teacherCloseSlot({ slotId })
    setPending(false)
    if (!result.ok) return setError(result.error)
    setConfirmId(null)
    setSlots((current) => current.filter((slot) => slot.id !== slotId))
    setOtherSlots((current) => current.filter((slot) => slot.id !== slotId))
    if (registrations?.slotId === slotId) setRegistrations(null)
  }

  async function showRegistrations(slotId: string) {
    setPending(true)
    setError(null)
    const result = await bookingApi.teacherListBookings({ slotId })
    setPending(false)
    if (!result.ok) return setError(result.error)
    setRegistrations({ slotId, rows: result.bookings })
  }

  const filteredSlots = slots.filter((slot) => teacherFilter === 'all' || slot.teacherId === teacherFilter)
  const filteredOther = otherSlots.filter((slot) => teacherFilter === 'all' || slot.teacherId === teacherFilter)
  const weekStart = startOfHktWeek(anchor)
  const weekDays = Array.from({ length: 7 }, (_, index) => addHktDays(weekStart, index))
  const monthCells = monthGrid(anchor.year, anchor.month)

  return (
    <Frame width="host">
      <main id="main">
        <p className="text-sm text-muted">{tx('導師後台', 'Teacher desk')}</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-[1.85rem] font-medium leading-snug">{tx('導師日曆', 'Teacher calendar')}</h1>
          {account ? (
            <Button variant="ghost" onClick={() => void signOut()}>
              {tx('登出', 'Sign out')}
            </Button>
          ) : null}
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          {tx(
            '小組與一對一使用各自的日曆。每場六十分鐘，時間以香港時間計算。這裡的登入不是房間密碼，也不是主持密碼。',
            'Group and one-on-one each have their own calendar. Every session is 60 minutes, shown in Hong Kong time. This login is separate from the room password and the host password.',
          )}
        </p>

        {error ? (
          <p className="mt-6 text-sm text-ink" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? <p className="mt-4 text-sm text-muted">{notice}</p> : null}

        {phase === 'loading' ? <p className="mt-8 text-sm text-muted">{tx('正在讀取日曆。', 'Loading the calendar.')}</p> : null}

        {phase === 'signed_out' ? (
          <Panel className="mt-8 max-w-xl px-6 py-6">
            <h2 className="text-lg font-medium">{tx('導師登入', 'Teacher sign in')}</h2>
            {liveBackend ? (
              <form
                className="mt-5 grid gap-4"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault()
                  void enter()
                }}
              >
                <label className="block" htmlFor="teacher-email">
                  <span className="text-sm text-ink">{tx('電郵', 'Email')}</span>
                  <Input
                    id="teacher-email"
                    className="mt-2"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </label>
                <label className="block" htmlFor="teacher-password">
                  <span className="text-sm text-ink">{tx('密碼', 'Password')}</span>
                  <Input
                    id="teacher-password"
                    className="mt-2"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={pending}>
                    {pending ? tx('正在登入', 'Signing in') : tx('登入', 'Sign in')}
                  </Button>
                  <Button type="button" variant="ghost" disabled={pending} onClick={() => void resetMail()}>
                    {tx('寄出重設密碼信', 'Email a password reset')}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="mt-5 grid gap-3">
                <p className="text-sm leading-relaxed text-muted">
                  {tx(
                    '這次是本機預覽，沒有真實登入。正式環境會用 Supabase Auth，並由營運者把登入連結到導師。',
                    'This is a local preview without a real login. Production uses Supabase Auth, and the operator links that login to a teacher.',
                  )}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button disabled={pending} onClick={() => void preview('teacher')}>
                    {tx('以 Andy 預覽', 'Preview as Andy')}
                  </Button>
                  <Button variant="outline" disabled={pending} onClick={() => void preview('operator')}>
                    {tx('以營運者預覽', 'Preview as operator')}
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        ) : null}

        {phase === 'unlinked' ? (
          <Panel className="mt-8 max-w-2xl px-6 py-6">
            <h2 className="text-lg font-medium">{tx('登入尚未連結', 'Login is not linked')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {tx(
                '請先在 Supabase Authentication 邀請或新增使用者，再於 SQL 編輯器執行連結。此函數不會設定密碼，也不會改動已開放的場次。',
                'Invite or add the user in Supabase Authentication, then run the link in the SQL editor. The function does not set a password and does not change sessions that are already open.',
              )}
            </p>
            <p className="mt-4 break-all font-latin text-sm text-ink">select public.link_teacher_login('andy', 'email');</p>
            <p className="mt-2 break-all font-latin text-sm text-ink">select public.link_teacher_login('vanessa', 'email');</p>
            <Button className="mt-5" variant="ghost" onClick={() => void signOut()}>
              {tx('登出', 'Sign out')}
            </Button>
          </Panel>
        ) : null}

        {phase === 'password' ? (
          <Panel className="mt-8 max-w-xl px-6 py-6">
            <h2 className="text-lg font-medium">{tx('設定密碼', 'Set a password')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {tx('請為這個導師登入設定密碼。之後用電郵與密碼進入。', 'Set a password for this teacher login. Next time, use the email and password.')}
            </p>
            <form
              className="mt-5 grid gap-4"
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                void savePassword()
              }}
            >
              <label className="block" htmlFor="teacher-new-password">
                <span className="text-sm text-ink">{tx('新密碼', 'New password')}</span>
                <Input
                  id="teacher-new-password"
                  className="mt-2"
                  type="password"
                  autoComplete="new-password"
                  value={nextPassword}
                  onChange={(event) => setNextPassword(event.target.value)}
                  required
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={pending}>
                  {pending ? tx('正在儲存', 'Saving') : tx('儲存密碼', 'Save password')}
                </Button>
                {passwordRequired ? null : (
                  <Button type="button" variant="ghost" onClick={() => setPhase('ready')}>
                    {tx('先進入日曆', 'Continue to the calendar')}
                  </Button>
                )}
              </div>
            </form>
          </Panel>
        ) : null}

        {phase === 'ready' && account ? (
          <section className="mt-8" aria-labelledby="teacher-calendar">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="teacher-calendar" className="text-lg font-medium">
                  {account.name}
                  <span className="ml-2 text-sm font-normal text-muted">
                    {account.role === 'operator' ? tx('營運', 'Operator') : tx('導師', 'Teacher')}
                  </span>
                </h2>
                <p className="mt-1 text-sm text-muted">{formatHktMonth(anchor, lang)}</p>
              </div>
              <Link to="/book" className="text-sm text-ink underline decoration-line underline-offset-4">
                {tx('查看公開預約頁', 'Open the public booking page')}
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label={tx('日曆', 'Calendars')}>
              <CalendarTab
                pressed={kind === 'group'}
                label={tx('小組日曆', 'Group calendar')}
                onClick={() => {
                  setKind('group')
                  setConfirmId(null)
                  setRegistrations(null)
                }}
              />
              <CalendarTab
                pressed={kind === 'one_on_one'}
                label={tx('一對一日曆', 'One-on-one calendar')}
                onClick={() => {
                  setKind('one_on_one')
                  setConfirmId(null)
                  setRegistrations(null)
                }}
              />
              <CalendarTab pressed={view === 'week'} label={tx('週', 'Week')} onClick={() => setView('week')} />
              <CalendarTab pressed={view === 'month'} label={tx('月', 'Month')} onClick={() => setView('month')} />
            </div>

            {account.role === 'operator' ? (
              <div className="mt-4 max-w-xl">
                <p className="text-sm leading-relaxed text-muted">
                  {tx(
                    '你可以查看場次，並在需要時緊急關閉。開放時段由導師在自己的日曆處理。',
                    'You can view sessions and close one when needed. Teachers open hours on their own calendar.',
                  )}
                </p>
                <label className="mt-3 block text-sm text-ink" htmlFor="teacher-filter">
                  {tx('導師', 'Teacher')}
                  <select
                    id="teacher-filter"
                    className="mt-2 h-12 w-full rounded-2xl border border-line bg-white px-4"
                    value={teacherFilter}
                    onChange={(event) => setTeacherFilter(event.target.value)}
                  >
                    <option value="all">{tx('全部', 'All')}</option>
                    {directory.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
                {kind === 'group'
                  ? tx('小組場次為隨緣樂助，無需預先付款。開放後即出現在公開預約頁。', 'Group sessions are give as you wish, with no advance payment. Once opened, they appear on the public booking page.')
                  : tx('一對一約一小時，本頁只供登記，不在此收款。只顯示你已開放的時段。', 'A one-on-one is about one hour. The public page only registers it and does not take payment. Only hours you open are shown.')}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const next = view === 'week' ? addHktDays(selected, -7) : addHktMonths(selected, -1)
                  setAnchor(next)
                  setSelected(next)
                }}
              >
                {tx('上一段', 'Previous')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAnchor(today)
                  setSelected(today)
                }}
              >
                {tx('今天', 'Today')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const next = view === 'week' ? addHktDays(selected, 7) : addHktMonths(selected, 1)
                  setAnchor(next)
                  setSelected(next)
                }}
              >
                {tx('下一段', 'Next')}
              </Button>
            </div>

            {view === 'week' ? (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {weekDays.map((day) => (
                  <DayButton
                    key={`${day.year}-${day.month}-${day.day}`}
                    day={day}
                    selected={sameHktDate(day, selected)}
                    count={countOnDay(filteredSlots, day)}
                    onSelect={() => setSelected(day)}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-7 gap-1">
                {monthCells.map((day) => (
                  <button
                    key={`${day.year}-${day.month}-${day.day}`}
                    type="button"
                    aria-pressed={sameHktDate(day, selected)}
                    onClick={() => {
                      setSelected(day)
                      setAnchor(day)
                    }}
                    className={cn(
                      'min-h-12 rounded-2xl border px-1 py-2 text-sm',
                      sameHktDate(day, selected) ? 'border-pink bg-blush' : 'border-transparent',
                      day.inMonth ? 'text-ink' : 'text-muted',
                    )}
                  >
                    {day.day}
                    {countOnDay(filteredSlots, day) > 0 ? <span className="mt-1 block text-[11px] text-muted">·</span> : null}
                  </button>
                ))}
              </div>
            )}

            <h3 className="mt-8 text-base font-medium">{formatHktDay(selected, lang)}</h3>
            <div className="mt-4 grid gap-3">
              {account.role === 'teacher'
                ? hoursFor().map((hour) => {
                    const slot = slotAtHour(filteredSlots, selected, hour)
                    const blocked = !slot && (hourBlocked(filteredOther, selected, hour) || hourBlocked(filteredSlots, selected, hour))
                    const past = new Date(hktHourIso(selected.year, selected.month, selected.day, hour)).getTime() < Date.now() - 5 * 60 * 1000
                    return (
                      <Panel key={hour} className="px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-ink">{formatHourRange(hour)}</p>
                            {slot ? <SlotMeta slot={slot} /> : null}
                            {blocked ? <p className="mt-1 text-sm text-muted">{tx('這個小時已經有場次。', 'That hour already has a session.')}</p> : null}
                          </div>
                          {slot ? (
                            <SlotActions
                              slot={slot}
                              pending={pending}
                              confirmId={confirmId}
                              registrations={registrations}
                              closeLabel={tx('關閉場次', 'Close session')}
                              onAsk={() => setConfirmId(slot.id)}
                              onCancelAsk={() => setConfirmId(null)}
                              onClose={() => void closeSlot(slot.id)}
                              onRegistrations={() => void showRegistrations(slot.id)}
                            />
                          ) : (
                            <Button disabled={pending || blocked || past} onClick={() => void openHour(hour)}>
                              {tx('開放此時段', 'Open this hour')}
                            </Button>
                          )}
                        </div>
                      </Panel>
                    )
                  })
                : daySlots(filteredSlots, selected).length === 0
                  ? <p className="text-sm text-muted">{tx('這日未有場次。', 'No sessions on this day.')}</p>
                  : daySlots(filteredSlots, selected).map((slot) => (
                      <Panel key={slot.id} className="px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-ink">{formatWhen(slot.startsAt, lang)}</p>
                            <p className="mt-1 text-sm text-muted">{slot.hostLabel ?? tx('未命名', 'Unnamed')}</p>
                            <SlotMeta slot={slot} />
                          </div>
                          <SlotActions
                            slot={slot}
                            pending={pending}
                            confirmId={confirmId}
                            registrations={registrations}
                            closeLabel={tx('緊急關閉', 'Close now')}
                            onAsk={() => setConfirmId(slot.id)}
                            onCancelAsk={() => setConfirmId(null)}
                            onClose={() => void closeSlot(slot.id)}
                            onRegistrations={() => void showRegistrations(slot.id)}
                          />
                        </div>
                      </Panel>
                    ))}
              {account.role === 'teacher'
                ? outsideHours(filteredSlots, selected).map((slot) => (
                <Panel key={slot.id} className="px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-ink">{formatWhen(slot.startsAt, lang)}</p>
                      <SlotMeta slot={slot} />
                    </div>
                    <SlotActions
                      slot={slot}
                      pending={pending}
                      confirmId={confirmId}
                      registrations={registrations}
                      closeLabel={account.role === 'operator' ? tx('緊急關閉', 'Close now') : tx('關閉場次', 'Close session')}
                      onAsk={() => setConfirmId(slot.id)}
                      onCancelAsk={() => setConfirmId(null)}
                      onClose={() => void closeSlot(slot.id)}
                      onRegistrations={() => void showRegistrations(slot.id)}
                    />
                  </div>
                </Panel>
              ))
                : null}
            </div>
          </section>
        ) : null}
      </main>
    </Frame>
  )
}

function CalendarTab({ pressed, label, onClick }: { pressed: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn('rounded-full px-4 py-2 text-sm', pressed ? 'bg-pink text-ink' : 'bg-white text-muted')}
    >
      {label}
    </button>
  )
}

function DayButton({
  day,
  selected,
  count,
  onSelect,
}: {
  day: HktDate
  selected: boolean
  count: number
  onSelect: () => void
}) {
  const { lang, tx } = useLang()
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn('rounded-[22px] border px-3 py-3 text-left text-sm', selected ? 'border-pink bg-blush' : 'border-line bg-white')}
    >
      <span className="block text-ink">{formatHktDay(day, lang)}</span>
      {count > 0 ? <span className="mt-1 block text-muted">{tx(`${count} 場`, `${count} sessions`)}</span> : null}
    </button>
  )
}

function SlotMeta({ slot }: { slot: PublicSlot }) {
  const { tx } = useLang()
  const state =
    slot.status === 'full'
      ? tx('已額滿', 'Full')
      : slot.status === 'started'
        ? tx('已經開始', 'Started')
        : tx('接受登記', 'Open')
  return (
    <p className="mt-1 text-sm text-muted">
      {tx(`已登記 ${slot.bookedCount} 人`, `${slot.bookedCount} registered`)}
      {' · '}
      {state}
    </p>
  )
}

function SlotActions({
  slot,
  pending,
  confirmId,
  registrations,
  closeLabel,
  onAsk,
  onCancelAsk,
  onClose,
  onRegistrations,
}: {
  slot: PublicSlot
  pending: boolean
  confirmId: string | null
  registrations: { slotId: string; rows: SlotBooking[] } | null
  closeLabel: string
  onAsk: () => void
  onCancelAsk: () => void
  onClose: () => void
  onRegistrations: () => void
}) {
  const { tx } = useLang()
  const rows = registrations?.slotId === slot.id ? registrations.rows : null
  return (
    <div className="grid justify-items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={pending} onClick={onRegistrations}>
          {tx('查看登記', 'View registrations')}
        </Button>
        {confirmId === slot.id ? (
          <>
            <Button disabled={pending} onClick={onClose}>
              {tx('確定關閉', 'Confirm close')}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={onCancelAsk}>
              {tx('返回', 'Back')}
            </Button>
          </>
        ) : (
          <Button variant="ghost" disabled={pending} onClick={onAsk}>
            {closeLabel}
          </Button>
        )}
      </div>
      {confirmId === slot.id ? (
        <p className="max-w-sm text-sm text-muted">
          {slot.bookedCount > 0
            ? tx('已有人登記。關閉後，公開預約頁不再顯示這一場。', 'People have registered. After you close it, the public booking page no longer shows this session.')
            : tx('關閉後，公開預約頁不再顯示這一場。', 'After you close it, the public booking page no longer shows this session.')}
        </p>
      ) : null}
      {rows ? (
        rows.length === 0 ? (
          <p className="text-sm text-muted">{tx('尚未有人登記。', 'Nobody has registered yet.')}</p>
        ) : (
          <ul className="text-sm text-ink">
            {rows.map((row) => (
              <li key={`${row.createdAt}-${row.name}`}>
                {row.name}
                {row.contact ? <span className="text-muted"> · {row.contact}</span> : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  )
}

function hoursFor() {
  return Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1 }, (_, index) => CALENDAR_START_HOUR + index)
}

function daySlots(slots: PublicSlot[], day: HktDate) {
  return slots.filter((slot) => onDay(slot, day))
}

function onDay(slot: PublicSlot, day: HktDate) {
  const parts = hktParts(new Date(slot.startsAt))
  return Boolean(parts && sameHktDate(parts, day))
}

function countOnDay(slots: PublicSlot[], day: HktDate) {
  return daySlots(slots, day).length
}

function slotAtHour(slots: PublicSlot[], day: HktDate, hour: number) {
  return slots.find((slot) => {
    const parts = hktParts(new Date(slot.startsAt))
    return Boolean(parts && sameHktDate(parts, day) && parts.hour === hour && parts.minute === 0)
  })
}

function hourBlocked(slots: PublicSlot[], day: HktDate, hour: number) {
  const start = new Date(hktHourIso(day.year, day.month, day.day, hour)).getTime()
  return slots.some((slot) => rangesOverlap(start, new Date(slot.startsAt).getTime()))
}

function outsideHours(slots: PublicSlot[], day: HktDate) {
  return daySlots(slots, day).filter((slot) => {
    const parts = hktParts(new Date(slot.startsAt))
    if (!parts) return false
    return parts.hour < CALENDAR_START_HOUR || parts.hour > CALENDAR_END_HOUR || parts.minute !== 0
  })
}
