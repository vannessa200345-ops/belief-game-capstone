import { liveBackend } from '../lib/env.ts'
import type { BookingApi } from './types.ts'

export const bookingApi: BookingApi = liveBackend
  ? (await import('./live.ts')).liveBooking
  : (await import('./mockStore.ts')).mockBooking

export type { BookingApi } from './types.ts'
