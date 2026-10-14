import { CAUSE_RANK, FEEDBACK } from './config.ts'
import type { PassengerSample, ThoughtCause, ThoughtIcon } from './types.ts'

export interface LiveThought {
  passengerId: string
  cause: ThoughtCause
  icon: ThoughtIcon
  mood: 'upset' | 'happy'
  x: number
  y: number
  z: number
  until: number
}

export interface ThoughtState {
  live: LiveThought[]
  /** Passenger id → sim time they may speak again. */
  cooldown: Map<string, number>
  nextSample: number
}

export interface ThoughtOptions {
  chance: number
  cap: number
  life: number
  cooldown: number
  sampleEvery: number
}

export function defaultThoughtOptions(): ThoughtOptions {
  return {
    chance: FEEDBACK.bubbleChance,
    cap: FEEDBACK.bubbleCap,
    life: FEEDBACK.bubbleLifeSec,
    cooldown: FEEDBACK.bubbleCooldownSec,
    sampleEvery: FEEDBACK.bubbleSampleEvery,
  }
}

export function emptyThoughts(now = 0): ThoughtState {
  return { live: [], cooldown: new Map(), nextSample: now }
}

/** Queue, then prices, then delight. Quiet passengers say nothing. */
export function causeFor(passenger: PassengerSample): ThoughtCause | null {
  if (passenger.queued || passenger.waitMin >= FEEDBACK.queueWaitMin) return 'queue'
  if (passenger.pricey && passenger.happiness < FEEDBACK.priceHappiness) return 'prices'
  if (passenger.happiness >= FEEDBACK.delightHappiness) return 'delight'
  return null
}

function roll(id: string, bucket: number): number {
  let h = bucket | 0
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}

/**
 * Keep a small pooled set of thoughts. Positions follow the passenger.
 * A sample every few seconds decides who speaks, so the field does not fill with icons.
 */
export function stepThoughts(
  state: ThoughtState,
  passengers: readonly PassengerSample[],
  now: number,
  options: ThoughtOptions = defaultThoughtOptions(),
): ThoughtState {
  const byId = new Map(passengers.map((p) => [p.id, p]))
  const live: LiveThought[] = []
  for (const thought of state.live) {
    if (thought.until <= now) continue
    const passenger = byId.get(thought.passengerId)
    if (!passenger) continue
    live.push({ ...thought, x: passenger.x, y: passenger.y, z: passenger.z })
  }

  const cooldown = new Map(state.cooldown)
  for (const [id, until] of cooldown) {
    if (until <= now) cooldown.delete(id)
  }

  let nextSample = state.nextSample
  if (now >= nextSample) {
    nextSample = now + options.sampleEvery
    const speaking = new Set(live.map((t) => t.passengerId))
    const bucket = Math.floor(now / Math.max(0.001, options.sampleEvery))
    const candidates: { passenger: PassengerSample; cause: ThoughtCause }[] = []
    for (const passenger of passengers) {
      if (speaking.has(passenger.id) || cooldown.has(passenger.id)) continue
      const cause = causeFor(passenger)
      if (!cause) continue
      if (roll(passenger.id, bucket) >= options.chance) continue
      candidates.push({ passenger, cause })
    }
    candidates.sort(
      (a, b) => CAUSE_RANK[a.cause] - CAUSE_RANK[b.cause] || (a.passenger.id < b.passenger.id ? -1 : 1),
    )
    for (const row of candidates) {
      if (live.length >= options.cap) break
      const until = now + options.life
      live.push({
        passengerId: row.passenger.id,
        cause: row.cause,
        icon: row.cause,
        mood: row.cause === 'delight' ? 'happy' : 'upset',
        x: row.passenger.x,
        y: row.passenger.y,
        z: row.passenger.z,
        until,
      })
      cooldown.set(row.passenger.id, until + options.cooldown)
    }
  }

  return { live, cooldown, nextSample }
}
