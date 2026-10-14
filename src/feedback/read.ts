import { DEFAULT_FEE_SCHEDULE } from '../commercial/fees.ts'
import { FEEDBACK } from './config.ts'
import type { AirlineMark, FeedbackWorld, LeverReading, MetricReading, PassengerSample } from './types.ts'

export interface FeedbackGuest {
  id: string
  dead?: boolean
  wx?: number
  wz?: number
  happiness: number
  thought?: string
  seated?: boolean
  serviceLeft?: number
  node?: string
}

export interface FeedbackLoad {
  kind: string
  estWaitSec: number
}

/** The slice of the airport the feedback layer reads. `Game` satisfies it. */
export interface FeedbackSource {
  clock: number
  paxServed: number
  flightsDone: number
  signed: readonly string[]
  reputation: number
  publishedFeeIndex: number
  fees: { paxFee: number }
  fits: readonly { rooms: { security?: number } }[]
  hallGuests: readonly FeedbackGuest[]
  hallNav: { loads(): readonly FeedbackLoad[] }
  airline(id: string): { name: string }
}

const MOVING = /heading|walking|way to|on the way|rolling a bag|bags accepted/i
const QUEUE = /queue|waiting|lane|scanner|carousel|stuck before|no security/i

export function passengerQueued(guest: FeedbackGuest): boolean {
  if (guest.seated) return false
  if ((guest.serviceLeft ?? 0) > 0 && guest.node === 'security') return true
  const thought = guest.thought ?? ''
  if (!thought || MOVING.test(thought)) return false
  return QUEUE.test(thought)
}

/** Build the pure world read from the live airport. No decisions happen here. */
export function readFeedback(source: FeedbackSource): FeedbackWorld {
  let securityWaitMin = 0
  for (const load of source.hallNav.loads()) {
    if (load.kind !== 'security_lane') continue
    securityWaitMin = Math.max(securityWaitMin, load.estWaitSec / 60)
  }

  let lanes = 0
  for (const fit of source.fits) lanes += fit.rooms.security ?? 0

  let moodSum = 0
  let moodCount = 0
  const passengers: PassengerSample[] = []
  const pricey =
    source.fees.paxFee > DEFAULT_FEE_SCHEDULE.paxFee * FEEDBACK.priceyFeeRatio ||
    source.publishedFeeIndex > FEEDBACK.priceyIndex

  for (const guest of source.hallGuests) {
    if (guest.dead) continue
    moodSum += guest.happiness
    moodCount += 1
    if (passengers.length >= FEEDBACK.passengerScan) continue
    if (guest.wx == null || guest.wz == null) continue
    const queued = passengerQueued(guest)
    passengers.push({
      id: guest.id,
      x: guest.wx,
      y: 0,
      z: guest.wz,
      happiness: guest.happiness,
      queued,
      waitMin: queued && guest.node === 'security' ? securityWaitMin : 0,
      pricey,
    })
  }

  const airlines: AirlineMark[] = source.signed.map((id) => ({ id, name: source.airline(id).name }))
  const mood = moodCount > 0 ? moodSum / moodCount : 0

  const metrics: MetricReading[] = [
    { id: 'security_wait', label: 'Security wait', value: securityWaitMin, unit: 'min' },
    { id: 'pax_mood', label: 'Passenger mood', value: mood, unit: 'pct' },
    { id: 'reputation', label: 'Reputation', value: source.reputation, unit: 'count' },
  ]
  const levers: LeverReading[] = [
    { id: 'security_lanes', metricId: 'security_wait', value: lanes },
    { id: 'pax_fee', metricId: 'pax_mood', value: source.fees.paxFee },
    { id: 'fee_index', metricId: 'reputation', value: source.publishedFeeIndex },
  ]

  return {
    now: source.clock,
    passengersServed: source.paxServed,
    flightsLanded: source.flightsDone,
    airlines,
    reputation: source.reputation,
    levers,
    metrics,
    passengers,
  }
}
