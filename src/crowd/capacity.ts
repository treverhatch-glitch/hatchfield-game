/**
 * Deterministic security-lane queue model mirroring trunk `tickSecurityLane`
 * (src/game/sim.ts) and PREFAB_TIERS (src/game/terminal.ts). Used to tune the
 * starter prefab so it does not bottleneck early, and documented in
 * docs/CROWD.md. Units are game seconds; one game day = 180 s.
 */
export interface LaneTuning {
  servers: number
  serviceSec: number
  /** `capGuests`: bodies at the node before the over-cap slowdown kicks in. */
  capGuests: number
  /** Slowdown per body over cap (trunk: 0.08, compounding with queue). */
  overPerBody: number
  /** Ceiling on the over-cap multiplier (trunk: none). */
  overMax: number
  /** Wear points added per screened body (trunk bumpWear avg ≈1.4). */
  wearPerBody: number
  /** Wear divisor in slowedService: svc × (1 + wear / divisor). Trunk 100. */
  wearDivisor: number
  /** Unstaffed multiplier (trunk 1.35). */
  unstaffedMult: number
  /** Departing bodies trickle to the doors over this window (trunk 0 = all at once). */
  releaseSpreadSec: number
}

export interface Traffic {
  /** Mean seconds between departing flights (one per turnaround). */
  flightGapSec: number
  /** Departing hall bodies per flight (trunk: pax / 5.5 jetway, clamp 6–18). */
  bodiesPerFlight: number
  staffed: boolean
  /** Janitor scrub, wear points removed per second (0 = none hired). */
  scrubPerSec: number
  /** Bodies give up (missed flight) after waiting this long. Trunk ≈ boarding window. */
  patienceSec?: number
  /** Optional growth: flight gap shrinks linearly to this by `rampToDay`. */
  rampGapSec?: number
  rampFromDay?: number
  rampToDay?: number
}

export interface DayStats {
  day: number
  maxQueue: number
  meanWaitSec: number
  served: number
  missed: number
}

export const DAY_SEC = 180

/** Trunk today: Prefab I · Linear. */
export const TRUNK_PREFAB_I: LaneTuning = {
  servers: 1,
  serviceSec: 3,
  capGuests: 28,
  overPerBody: 0.08,
  overMax: Infinity,
  wearPerBody: 1.4,
  wearDivisor: 100,
  unstaffedMult: 1.35,
  releaseSpreadSec: 0,
}

/** Proposal in docs/CROWD.md. */
export const PROPOSED_PREFAB_I: LaneTuning = {
  servers: 2,
  serviceSec: 3.5,
  capGuests: 40,
  overPerBody: 0.02,
  overMax: 1.4,
  wearPerBody: 0.7,
  wearDivisor: 200,
  unstaffedMult: 1.35,
  releaseSpreadSec: 45,
}

/** Starter kit: 1 strip, 2 stands, first 1–2 contracts, desk staff hired. */
export const STARTER: Traffic = { flightGapSec: 40, bodiesPerFlight: 11, staffed: true, scrubPerSec: 0 }
/** Player grown: 3–4 airlines, 4 stands, a hub, bigger jets. */
export const GROWN: Traffic = { flightGapSec: 22, bodiesPerFlight: 14, staffed: true, scrubPerSec: 0 }
/** QA "heavy" run: hub airline, max bank, nobody staffing the lane. */
export const QA_HEAVY: Traffic = { flightGapSec: 20, bodiesPerFlight: 14, staffed: false, scrubPerSec: 0 }

/** Small seeded PRNG so runs are repeatable. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function simulateLane(
  lane: LaneTuning,
  traffic: Traffic,
  days: number,
  seed = 7,
  dt = 0.25,
): DayStats[] {
  const r = rng(seed)
  const waiting: number[] = [] // arrival times
  const pending: number[] = [] // release times not yet at the lane
  const busy: number[] = [] // service time left per server slot
  let wear = 0
  let nextFlight = 15
  const out: DayStats[] = []
  let day = { day: 1, maxQueue: 0, waitSum: 0, served: 0, missed: 0 }
  for (let t = 0; t < days * DAY_SEC; t += dt) {
    const d = Math.floor(t / DAY_SEC) + 1
    if (d !== day.day) {
      out.push({ day: day.day, maxQueue: day.maxQueue, meanWaitSec: day.served ? day.waitSum / day.served : 0, served: day.served, missed: day.missed })
      day = { day: d, maxQueue: 0, waitSum: 0, served: 0, missed: 0 }
    }
    if (t >= nextFlight) {
      const n = Math.max(6, Math.min(18, Math.round(traffic.bodiesPerFlight * (0.8 + r() * 0.4))))
      for (let k = 0; k < n; k++) pending.push(t + r() * lane.releaseSpreadSec)
      nextFlight = t + gapAt(traffic, t / DAY_SEC + 1) * (0.7 + r() * 0.6)
    }
    for (let k = pending.length - 1; k >= 0; k--) {
      if (pending[k] <= t) {
        waiting.push(pending[k])
        pending.splice(k, 1)
      }
    }
    const pat = traffic.patienceSec ?? 150
    while (waiting.length && t - waiting[0] > pat) {
      waiting.shift()
      day.missed++
    }
    // Same formula as tickSecurityLane, with the proposed caps.
    const atNode = waiting.length + busy.length
    let svc = lane.serviceSec * (1 + wear / lane.wearDivisor)
    if (!traffic.staffed) svc *= lane.unstaffedMult
    if (atNode > lane.capGuests) svc *= Math.min(lane.overMax, 1 + (atNode - lane.capGuests) * lane.overPerBody)
    for (let k = busy.length - 1; k >= 0; k--) {
      busy[k] -= dt
      if (busy[k] <= 0) busy.splice(k, 1)
    }
    while (busy.length < lane.servers && waiting.length) {
      const arr = waiting.shift()!
      day.waitSum += t - arr
      day.served++
      busy.push(svc)
      wear = Math.min(100, wear + lane.wearPerBody)
    }
    wear = Math.max(0, wear - traffic.scrubPerSec * dt)
    day.maxQueue = Math.max(day.maxQueue, waiting.length)
  }
  out.push({ day: day.day, maxQueue: day.maxQueue, meanWaitSec: day.served ? day.waitSum / day.served : 0, served: day.served, missed: day.missed })
  return out
}

/** Offered load ρ = arrival rate × service time / servers (fresh lane). */
export function utilisation(lane: LaneTuning, traffic: Traffic, wear = 0): number {
  const lambda = traffic.bodiesPerFlight / traffic.flightGapSec
  let svc = lane.serviceSec * (1 + wear / lane.wearDivisor)
  if (!traffic.staffed) svc *= lane.unstaffedMult
  return (lambda * svc) / lane.servers
}

/** Flight gap on a fractional game day, honouring an optional ramp. */
export function gapAt(traffic: Traffic, day: number): number {
  if (traffic.rampGapSec == null) return traffic.flightGapSec
  const a = traffic.rampFromDay ?? 1
  const b = traffic.rampToDay ?? a + 1
  const k = Math.max(0, Math.min(1, (day - a) / (b - a)))
  return traffic.flightGapSec + (traffic.rampGapSec - traffic.flightGapSec) * k
}

/** Starter traffic for 4 days, then the player signs airlines until day 10. */
export const RAMP: Traffic = { ...STARTER, rampGapSec: 22, rampFromDay: 4, rampToDay: 10 }
