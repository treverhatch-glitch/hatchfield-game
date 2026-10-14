/**
 * Guests with personalities on the terminal walk, RollerCoaster Tycoon style:
 * seeded traits, needs that rise over time, thoughts that move satisfaction,
 * and signage that keeps first-timers from getting lost. Pure and
 * deterministic; PaxNav owns the walking and calls in here on each guest's
 * staggered "think" step, never per frame.
 *
 * Every roll comes from the guest's own id and the walk's seed, so the same
 * guest always has the same traits and the same choices, whoever else is in
 * the hall and whatever order they arrived in. Nothing here needs saving: a
 * reload rebuilds identical guests from their ids.
 */
import {
  GUEST_FLAGS,
  GUEST_PURPOSES,
  GUEST_TUNING,
  NEED_KEYS,
  PLACE_WORDS,
  THOUGHTS,
  TRAIT_FX,
  type AmenityStop,
  type DecayNeed,
  type GuestFlag,
  type GuestPurpose,
  type GuestTrait,
  type NeedKey,
  type ThoughtKey,
  type TraitFx,
} from './guestConfig.ts'
import { cellX, cellZ, type NavGrid } from './grid.ts'

export const NEED_INDEX: Record<NeedKey, number> = Object.fromEntries(NEED_KEYS.map((k, i) => [k, i])) as Record<
  NeedKey,
  number
>
const THOUGHT_KEYS = Object.keys(THOUGHTS) as ThoughtKey[]
const THOUGHT_INDEX = new Map(THOUGHT_KEYS.map((k, i) => [k, i]))

export interface GuestThought {
  key: ThoughtKey
  icon: string
  text: string
  /** Nav seconds. */
  at: number
}

/** A guest's mind: traits, needs, mood and what they have been thinking. */
export interface Mind {
  purpose: GuestPurpose
  traits: GuestTrait[]
  fx: TraitFx
  /** NEED_KEYS order, 0..1. */
  needs: Float32Array
  /** 0–100. */
  sat: number
  spent: number
  thoughts: GuestThought[]
  /** Last time each thought landed (THOUGHTS key order), -Infinity when never. */
  said: Float64Array
  /** Own rng state (mulberry32). */
  rs: number
  thinkAt: number
  lastThink: number
  /** Patience in a line before traits and anxiety, seconds. */
  patienceSec: number
  lostTimes: number
  complaints: number
  /** Per line visit: already said the queue was long / complained. */
  saidLong: boolean
  saidComplain: boolean
  /** A counter that let them down (empty shelf): not tried again until `avoidUntil`. */
  avoidId: string | null
  avoidUntil: number
}

export function hashId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Next 0..1 from the mind's own stream. */
export function rnd(m: { rs: number }): number {
  m.rs = (m.rs + 0x6d2b79f5) >>> 0
  let t = m.rs
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Stack trait effects by multiplying. */
export function combineFx(traits: readonly GuestTrait[]): TraitFx {
  const out: TraitFx = { speed: 1, patience: 1, spend: 1, anxiety: 1, lost: 1, decay: {}, taste: {} }
  for (const t of traits) {
    const fx = TRAIT_FX[t]
    out.speed *= fx.speed
    out.patience *= fx.patience
    out.spend *= fx.spend
    out.anxiety *= fx.anxiety
    out.lost *= fx.lost
    for (const [k, v] of Object.entries(fx.decay) as [DecayNeed, number][]) out.decay[k] = (out.decay[k] ?? 1) * v
    for (const [k, v] of Object.entries(fx.taste) as [AmenityStop, number][]) out.taste[k] = (out.taste[k] ?? 1) * v
  }
  return out
}

function pickShare<K extends string>(m: { rs: number }, shares: Record<K, number>, keys: readonly K[]): K {
  let total = 0
  for (const k of keys) total += Math.max(0, shares[k])
  let r = rnd(m) * total
  for (const k of keys) {
    r -= Math.max(0, shares[k])
    if (r < 0) return k
  }
  return keys[keys.length - 1]
}

export interface GuestHint {
  purpose?: GuestPurpose
  /** Force flags (tests, groups). Rolled flags are added to these. */
  flags?: readonly GuestFlag[]
}

/** Roll a guest's traits and starting needs from their id. Same id and seed, same guest. */
export function rollMind(id: string, seed: number, now: number, hint: GuestHint = {}): Mind {
  const T = GUEST_TUNING
  const st = { rs: (hashId(id) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0 }
  rnd(st)
  const purpose = hint.purpose ?? pickShare(st, T.purposeShare, GUEST_PURPOSES)
  const share = T.flagShare[purpose]
  const flags = new Set<GuestFlag>(hint.flags ?? [])
  const rolls = GUEST_FLAGS.map(() => rnd(st))
  if (rolls[0] < share.first_timer) flags.add('first_timer')
  else if (rolls[1] < share.frequent_flyer && !flags.has('first_timer')) flags.add('frequent_flyer')
  if (rolls[2] < share.reduced_mobility) flags.add('reduced_mobility')
  if (rolls[3] < share.with_kids) flags.add('with_kids')
  if (flags.has('first_timer')) flags.delete('frequent_flyer')
  const traits: GuestTrait[] = [purpose, ...GUEST_FLAGS.filter((f) => flags.has(f))]
  const fx = combineFx(traits)
  const needs = new Float32Array(NEED_KEYS.length)
  for (const [k, top] of Object.entries(T.startNeed) as [DecayNeed, number][]) needs[NEED_INDEX[k]] = rnd(st) * top
  return {
    purpose,
    traits,
    fx,
    needs,
    sat: T.startSatisfaction,
    spent: 0,
    thoughts: [],
    said: new Float64Array(THOUGHT_KEYS.length).fill(-Infinity),
    rs: st.rs,
    // Stagger: nobody thinks on the same tick as everyone else.
    thinkAt: now + rnd(st) * T.thinkSec,
    lastThink: now,
    patienceSec: T.patienceSec * fx.patience,
    lostTimes: 0,
    complaints: 0,
    saidLong: false,
    saidComplain: false,
    avoidId: null,
    avoidUntil: -Infinity,
  }
}

export function need(m: Mind, k: NeedKey): number {
  return m.needs[NEED_INDEX[k]]
}

function setNeed(m: Mind, k: NeedKey, v: number) {
  m.needs[NEED_INDEX[k]] = Math.max(0, Math.min(1, v))
}

/** What the guest is doing, for how fast needs move. */
export type Activity = 'walk' | 'queue' | 'seated' | 'idle'

/** Raise (or, seated, recover) needs over `dt` seconds. `crowd` is bodies on their cell. */
export function decayNeeds(m: Mind, dt: number, act: Activity, crowd: number) {
  const T = GUEST_TUNING
  const h = dt / 3600
  const ctx = act === 'queue' ? T.context.queue : act === 'walk' ? T.context.walk : null
  for (const k of Object.keys(T.decayPerHour) as DecayNeed[]) {
    const trait = m.fx.decay[k] ?? 1
    let rate = T.decayPerHour[k] * trait
    if (act === 'seated') {
      const s = (T.context.seated as Partial<Record<DecayNeed, number>>)[k]
      // Below zero: sitting recovers it (faster for those who tire easily is not a thing; flat).
      if (s !== undefined) rate = s < 0 ? s : rate * s
    } else if (ctx) rate *= (ctx as Partial<Record<DecayNeed, number>>)[k] ?? 1
    if (k === 'comfort' && crowd > T.crowdCellPax) rate += (crowd - T.crowdCellPax) * T.crowdComfortPerPax * trait
    setNeed(m, k, need(m, k) + rate * h)
  }
}

/** Anxiety from the slack to boarding: 0 with plenty of time, 1 at none. Boards calm it. */
export function anxietyFrom(m: Mind, slackSec: number, calm: boolean): number {
  const T = GUEST_TUNING
  const raw = Math.max(0, Math.min(1, (T.anxietyWindowSec - slackSec) / T.anxietyWindowSec))
  const v = Math.min(1, raw * raw * m.fx.anxiety * (calm ? 1 - T.boardCalm : 1))
  setNeed(m, 'anxiety', v)
  return v
}

/** How badly they want an amenity right now, before time and anxiety. */
export function amenityUrge(m: Mind, s: AmenityStop): number {
  if (s === 'toilet') return need(m, 'bladder')
  if (s === 'food') return Math.max(need(m, 'hunger'), need(m, 'thirst') * 0.9)
  return need(m, 'boredom') * Math.min(1.5, m.fx.spend)
}

/**
 * Utility of a stop: the urge (by taste), less anxiety, less the share of the
 * slack it would eat. -Infinity when it does not fit before boarding.
 */
export function amenityScore(m: Mind, s: AmenityStop, stopSec: number, slackSec: number, needSlackSec: number): number {
  const T = GUEST_TUNING
  const urge = amenityUrge(m, s)
  if (urge < T.needMin) return -Infinity
  if (slackSec < stopSec + needSlackSec) return -Infinity
  const taste = m.fx.taste[s] ?? 1
  return urge * taste - need(m, 'anxiety') * T.anxietyWeight - (stopSec / Math.max(1, slackSec)) * T.timeWeight
}

/** After a stop: the need it serves drops. */
export function relieve(m: Mind, s: AmenityStop) {
  for (const [k, v] of Object.entries(GUEST_TUNING.relief[s]) as [DecayNeed, number][]) setNeed(m, k, need(m, k) - v)
}

/** Patience in a line right now: traits, cut by anxiety. */
export function patienceNow(m: Mind): number {
  return m.patienceSec * (1 - need(m, 'anxiety') * GUEST_TUNING.anxietyPatienceCut)
}

/**
 * Land a thought: satisfaction moves, the card keeps it. Returns the
 * satisfaction change, 0 if the same thought landed too recently.
 */
export function think(m: Mind, key: ThoughtKey, now: number, place?: string): number {
  const T = GUEST_TUNING
  const i = THOUGHT_INDEX.get(key)!
  if (now - m.said[i] < T.thoughtCooldownSec) return 0
  m.said[i] = now
  const def = THOUGHTS[key]
  const text = def.text.replace('{place}', place ? (PLACE_WORDS[place] ?? place) : 'way')
  m.thoughts.push({ key, icon: def.icon, text, at: now })
  if (m.thoughts.length > T.thoughtsKept) m.thoughts.shift()
  const before = m.sat
  m.sat = Math.max(0, Math.min(100, m.sat + def.delta))
  return m.sat - before
}

/** Reputation change (sim 0–100 scale) from a batch of guest feedback. */
export function feedbackReputation(fb: { satDelta: number; missed: number; complaints: number }): number {
  const T = GUEST_TUNING
  const v = fb.satDelta * T.repPerSatPoint + fb.missed * T.repPerMissed + fb.complaints * T.repPerComplaint
  return Number.isFinite(v) ? v : 0
}

// ---------------------------------------------------------------- signage

/** A placed sign or departure board, terminal metres. */
export interface SignSpot {
  x: number
  z: number
}

export interface Signage {
  signs: SignSpot[]
  boards: SignSpot[]
  /** Signs that come with a prefab scheme, counted everywhere. */
  schemeSigns: number
}

export const NO_SIGNAGE: Signage = { signs: [], boards: [], schemeSigns: 0 }

export interface SignField {
  /** Per cell: 1 + coverage. Lost chance divides by it. */
  div: Float32Array
  /** Per cell: a departure board is in view. */
  board: Uint8Array
}

/** Wayfinding coverage per nav cell. Built on layout or signage change, never per tick. */
export function buildSignField(g: NavGrid, s: Signage): SignField {
  const T = GUEST_TUNING
  const n = g.gw * g.gh
  const div = new Float32Array(n).fill(1 + Math.max(0, s.schemeSigns) * T.schemeSignWeight)
  const board = new Uint8Array(n)
  const stamp = (spots: SignSpot[], r: number, w: number, mark: boolean) => {
    const r2 = r * r
    for (const sp of spots) {
      for (let c = 0; c < n; c++) {
        if (!g.mask[c]) continue
        const dx = cellX(g, c) - sp.x
        const dz = cellZ(g, c) - sp.z
        const d2 = dx * dx + dz * dz
        if (d2 > r2) continue
        // Full weight close by, half at the edge of range.
        div[c] += w * (1 - 0.5 * Math.sqrt(d2) / r)
        if (mark) board[c] = 1
      }
    }
  }
  stamp(s.signs, T.signRadiusM, T.signWeight, false)
  stamp(s.boards, T.boardRadiusM, T.boardWeight, true)
  return { div, board }
}
