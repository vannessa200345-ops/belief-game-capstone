import type { PublicSlot, PublicTeacher, SlotKind } from './types.ts'

/** Open slots for one teacher and one format. Full, closed, and non-bookable rows stay off the public list. */
export function filterPublicSlots(
  slots: PublicSlot[],
  teachers: PublicTeacher[],
  kind: SlotKind,
  teacherId: string,
) {
  const teacher = teachers.find((item) => item.id === teacherId)
  if (!teacher?.bookable) return []
  const closedIds = new Set(teachers.filter((item) => !item.bookable).map((item) => item.id))
  const closedNames = new Set(teachers.filter((item) => !item.bookable).map((item) => item.name))
  return slots.filter((item) => {
    if (item.kind !== kind || item.status !== 'open' || item.bookedCount >= item.capacity) return false
    if (item.teacherId && closedIds.has(item.teacherId)) return false
    if (item.hostLabel && closedNames.has(item.hostLabel)) return false
    if (item.teacherId) return item.teacherId === teacher.id
    return item.hostLabel === teacher.name
  })
}
