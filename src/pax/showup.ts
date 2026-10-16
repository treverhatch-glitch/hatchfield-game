/**
 * Departure show-up. Pure planner — a later `src/pax` module can replace this
 * file. The sim calls `planShowUp` when a slot is banked and releases at most
 * four passengers per second per entrance.
 *
 * One sim-second is eight game minutes (the same clock as diplomacy).
 * Scheduled departure (STD) is the slot's approach ETA plus `PLANNED_TURN_SEC`.
 * The 240 game-minute outer lead therefore opens before the aircraft is
 * pushed onto approach, so bodies are in the hall before landing.
 */

export const GAME_MINUTES_PER_SIM_SECOND = 8

/** Nobody arrives earlier than STD minus this many game minutes. */
export const SHOWUP_LEAD_GAME_MIN = 240
/** Budget and family. */
export const LEISURE_LEAD_GAME_MIN = 180
/** Business and premium. */
export const TIMED_LEAD_GAME_MIN = 120
export const CHECKIN_CLOSE_INTL_GAME_MIN = 45
export const CHECKIN_CLOSE_DOM_GAME_MIN = 30
export const MAX_SPAWNS_PER_SEC = 4
/** Last release sits this far ahead of the counter closing, so the bag drop can start. */
export const CHECKIN_WALK_SEC = 1.25
/**
 * Approach ETA → scheduled departure for the hall. Leisure show-up
 * (STD − 180 game-min) opens a couple of seconds before the slot is due,
 * which is before landing.
 *
 * The schedule chart does not use this gap. Bar length is `turnMin` in
 * `src/ui/timetable/scheduleConfig.ts` (narrowbody 40 game minutes, inside
 * the 35–45 minute band). Leave this hall clock alone until show-up is
 * retargeted onto that config — the two must not both draw the bar.
 */
export const PLANNED_TURN_SEC = 20

export type ShowTag = 'budget' | 'family' | 'business' | 'premium'

export function gameMinToSim(min: number): number {
  return min / GAME_MINUTES_PER_SIM_SECOND
}

/** Wide-body turns are the international clock (check-in closes earlier). */
export function isIntlKind(kind: string): boolean {
  return kind === 'widebody'
}

/**
 * One international test for show-up timing and the arrival passport stage.
 * A route flag wins once the route carries one. Until then, wide-bodies are international.
 */
export function flightIsIntl(flight: { kind?: string; intl?: boolean } | null | undefined): boolean {
  if (!flight) return false
  if (typeof flight.intl === 'boolean') return flight.intl
  return isIntlKind(flight.kind ?? '')
}

export function checkInCloseAt(std: number, intl: boolean): number {
  const lead = intl ? CHECKIN_CLOSE_INTL_GAME_MIN : CHECKIN_CLOSE_DOM_GAME_MIN
  return std - gameMinToSim(lead)
}

export function leadSecForTag(tag: ShowTag): number {
  const min = tag === 'business' || tag === 'premium' ? TIMED_LEAD_GAME_MIN : LEISURE_LEAD_GAME_MIN
  return gameMinToSim(min)
}

/**
 * One stamped body on a banked departure. Parallel to `tags` / `releases`.
 * `leadSimSec` is the show-up lead so a moved STD can be restamped.
 */
export interface ShowUpSeat {
  segment: 'road_warrior' | 'lounge_lover' | 'normal'
  preferFastTrack: boolean
  amenity: 'lounge' | 'cafe' | 'none'
  leadSimSec: number
  spendLounge: number
  spendAmenity: number
  willLounge: number
  willAmenity: number
  moodArrive: number
  moodFast: number
  moodStandard: number
  moodLounge: number
  moodMiss: number
  /** International extra already folded into `leadSimSec`. */
  intlApplied?: boolean
}

/** One banked departure. The sim owns the list and fills `spawned` / `flightId`. */
export interface ShowUpPlan {
  slotId: string
  std: number
  hallId: string
  airlineId: string
  intl: boolean
  tags: ShowTag[]
  releases: number[]
  spawned: number
  flightId: string | null
  closed: boolean
  /** Present when the wave was drawn from `createPaxShowUpAdapter`. */
  seats?: ShowUpSeat[]
}

export interface ShowUpInput {
  std: number
  now: number
  tags: readonly ShowTag[]
  intl: boolean
  /** Release times already promised at this entrance. */
  taken?: readonly number[]
  /**
   * Absolute release times from `stampDeparture`, one per tag, same order.
   * The entrance cap still snaps them. Omitted plans keep the tag windows.
   */
  desired?: readonly (number | null)[]
}

/**
 * Absolute sim-clock release times, one per tag.
 * Leisure opens at STD−180 game-min, business and premium at STD−120,
 * and nothing is earlier than STD−240. The last seat is before check-in
 * closes (STD−45 intl / STD−30 dom), except when `now` is already past
 * close — then the wave drips from `now` so a late seed is not stranded.
 * No entrance second holds more than three releases.
 */
export function planShowUp(input: ShowUpInput): number[] {
  const { std, now, tags, intl } = input
  if (!tags.length) return []
  const close = checkInCloseAt(std, intl)
  const outer = std - gameMinToSim(SHOWUP_LEAD_GAME_MIN)

  if (now >= close - 1e-6) {
    const raw = tags.map((_, i) => now + i / MAX_SPAWNS_PER_SEC)
    return rateLimit(raw, input.taken, now, undefined)
  }

  const last = Math.max(now, close - CHECKIN_WALK_SEC)
  const desired = input.desired
  if (desired && desired.length === tags.length) {
    const raw = spreadLeads(desired, now, outer, last)
    return rateLimit(raw, input.taken, now, last)
  }
  const byOpen = new Map<number, number>()
  for (const tag of tags) {
    const open = Math.max(now, outer, std - leadSecForTag(tag))
    const key = Math.round(open * 1000) / 1000
    byOpen.set(key, (byOpen.get(key) ?? 0) + 1)
  }

  const raw: number[] = []
  const opens = [...byOpen.keys()].sort((a, b) => a - b)
  for (const open of opens) {
    const n = byOpen.get(open) ?? 0
    const start = Math.min(open, last)
    const end = Math.max(start, last)
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? start : start + ((end - start) * i) / (n - 1)
      raw.push(t)
    }
  }
  raw.sort((a, b) => a - b)
  return rateLimit(raw, input.taken, now, last)
}

/**
 * Keep stamp order (early leads stay early) but stretch a clump out to
 * check-in close. A tight normal draw would otherwise hit the lane together.
 * Nobody is placed before their own lead.
 */
function spreadLeads(
  desired: readonly (number | null)[],
  now: number,
  outer: number,
  last: number,
): number[] {
  const clamped = desired.map((want) => {
    const t = want == null || !Number.isFinite(want) ? now : want
    return Math.min(last, Math.max(now, outer, t))
  })
  const order = clamped.map((_, i) => i).sort((a, b) => clamped[a] - clamped[b] || a - b)
  const n = order.length
  const start = clamped[order[0] ?? 0] ?? now
  const end = Math.max(start, last)
  const out = new Array<number>(n)
  let prev = now
  for (let k = 0; k < n; k++) {
    const i = order[k]
    const even = n === 1 ? start : start + ((end - start) * k) / (n - 1)
    const t = Math.min(last, Math.max(clamped[i], even, prev))
    out[i] = t
    prev = t
  }
  return out
}

function secondOf(t: number): number {
  return Math.floor(t + 1e-6)
}

/** Pack releases so each whole sim-second holds at most three, at this entrance. */
function rateLimit(
  desired: readonly number[],
  taken: readonly number[] | undefined,
  floorTime: number,
  ceiling: number | undefined,
): number[] {
  const load = new Map<number, number>()
  const note = (t: number) => {
    const s = secondOf(t)
    load.set(s, (load.get(s) ?? 0) + 1)
  }
  if (taken) for (const t of taken) note(t)

  const out: number[] = []
  const minSec = secondOf(floorTime)
  const maxSec =
    ceiling == null ? minSec + desired.length + 4 : secondOf(Math.max(floorTime, ceiling))

  for (const want of desired) {
    let sec = secondOf(Math.max(want, floorTime))
    if (sec < minSec) sec = minSec
    const candidates: number[] = []
    for (let s = sec; s <= maxSec; s++) candidates.push(s)
    for (let s = sec - 1; s >= minSec; s--) candidates.push(s)
    let placed = false
    for (const s of candidates) {
      const n = load.get(s) ?? 0
      if (n >= MAX_SPAWNS_PER_SEC) continue
      const t = s + n / MAX_SPAWNS_PER_SEC
      if (t + 1e-6 < floorTime) continue
      if (ceiling != null && t > ceiling + 1e-6) continue
      load.set(s, n + 1)
      out.push(Math.max(floorTime, t))
      placed = true
      break
    }
    if (!placed) {
      let s = Math.max(maxSec, minSec)
      while ((load.get(s) ?? 0) >= MAX_SPAWNS_PER_SEC) s += 1
      const n = load.get(s) ?? 0
      const t = Math.max(floorTime, s + n / MAX_SPAWNS_PER_SEC)
      load.set(s, n + 1)
      out.push(t)
    }
  }
  return out
}
