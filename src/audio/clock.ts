let offsetMs = 0
let ready = false

export function setClockOffset(next: number) {
  if (!Number.isFinite(next)) return
  offsetMs = next
  ready = true
}

export function resetClock() {
  offsetMs = 0
  ready = false
}

export function isClockReady() {
  return ready
}

/** Host clock, estimated on other devices. On the host, pass through Date.now(). */
export function hostNow(now = Date.now()) {
  return now + offsetMs
}
