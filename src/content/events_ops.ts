/**
 * Live ops events: strikes, outages, bird strikes, VIP visits.
 * Each one uses a hook the sim already has: slower check-in or screening,
 * a stand out of service, or a delay on the next departures.
 * Pure; the sim feeds the world in and raises the alert row.
 */
import { simRandom } from '../game/simRng.ts'

/** Which existing sim hook the event leans on. */
export type OpsEffectKind = 'checkin' | 'security' | 'gate' | 'delay'

/** Where "Pan to problem" lands. */
export type OpsFocus = 'checkin' | 'security' | 'gate' | 'runway'

export interface OpsEffect {
  kind: OpsEffectKind
  /** Processing-time multiplier for 'checkin' / 'security'. 1 = normal. */
  mult?: number
  /** Stands taken out of service for 'gate'. */
  gates?: number
  /** Sim seconds each departure in the window slips for 'delay'. */
  delaySec?: number
}

export interface OpsEvent {
  id: string
  name: string
  blurb: string
  fix: string
  severity: 'critical' | 'warning' | 'info'
  focus: OpsFocus
  minLevel: number
  /** Daily odds at minLevel; each level above adds perLevel, capped at OPS_TUNING.maxDailyOdds. */
  baseOdds: number
  perLevel: number
  durationHours: [number, number]
  effect: OpsEffect
}

export const OPS_TUNING = {
  /** No ops events before this in-game day (day 0 is the opening day). */
  quietDays: 3,
  /** Matches the sim clock: one day is 180s, one hour is 7.5s. */
  daySec: 180,
  hourSec: 7.5,
  maxDailyOdds: 0.35,
} as const

export const OPS_ALERT_PREFIX = 'ops:'

export const OPS_EVENTS: readonly OpsEvent[] = [
  {
    id: 'checkin_it_outage',
    name: 'Check-in IT outage',
    blurb: 'The departure control system is down. Agents are checking passengers in by hand.',
    fix: 'Open more desks and staff them until the system is back.',
    severity: 'warning',
    focus: 'checkin',
    minLevel: 1,
    baseOdds: 0.05,
    perLevel: 0.012,
    durationHours: [2, 5],
    effect: { kind: 'checkin', mult: 2.2 },
  },
  {
    id: 'scanner_fault',
    name: 'X-ray scanner fault',
    blurb: 'A lane scanner keeps rejecting trays. Every bag gets a second look.',
    fix: 'Add a security lane or keep lanes serviced so wear stays low.',
    severity: 'warning',
    focus: 'security',
    minLevel: 1,
    baseOdds: 0.05,
    perLevel: 0.01,
    durationHours: [1, 4],
    effect: { kind: 'security', mult: 1.5 },
  },
  {
    id: 'bird_strike',
    name: 'Bird strike',
    blurb: 'A departure ingested birds on rotation. The runway is swept before the next movement.',
    fix: 'Next departures are slipping. Spread the timetable so banks recover faster.',
    severity: 'warning',
    focus: 'runway',
    minLevel: 1,
    baseOdds: 0.04,
    perLevel: 0.012,
    durationHours: [1, 2],
    effect: { kind: 'delay', delaySec: 14 },
  },
  {
    id: 'jet_bridge_fault',
    name: 'Jet bridge fault',
    blurb: 'A gate is out of service while the jet bridge hydraulics are repaired.',
    fix: 'Keep a spare stand free so one closed gate does not stack arrivals.',
    severity: 'info',
    focus: 'gate',
    minLevel: 1,
    baseOdds: 0.05,
    perLevel: 0.01,
    durationHours: [3, 8],
    effect: { kind: 'gate', gates: 1 },
  },
  {
    id: 'fuel_spill',
    name: 'Fuel spill on stand',
    blurb: 'A refuel hose split. The stand is closed until the spill is cleaned up.',
    fix: 'Build spare stands so turnarounds can move elsewhere.',
    severity: 'warning',
    focus: 'gate',
    minLevel: 2,
    baseOdds: 0.03,
    perLevel: 0.01,
    durationHours: [2, 4],
    effect: { kind: 'gate', gates: 1 },
  },
  {
    id: 'vip_visit',
    name: 'VIP visit',
    blurb: 'A head of state is passing through. A stand is held for the motorcade.',
    fix: 'The stand comes back when the visit ends. Keep spare stand capacity.',
    severity: 'info',
    focus: 'gate',
    minLevel: 2,
    baseOdds: 0.025,
    perLevel: 0.012,
    durationHours: [4, 8],
    effect: { kind: 'gate', gates: 1 },
  },
  {
    id: 'baggage_strike',
    name: 'Baggage handler strike',
    blurb: 'Handlers walked out. Passengers wait at the desk while bags pile up.',
    fix: 'Add desks to spread the queue until the strike ends.',
    severity: 'warning',
    focus: 'checkin',
    minLevel: 3,
    baseOdds: 0.025,
    perLevel: 0.01,
    durationHours: [6, 12],
    effect: { kind: 'checkin', mult: 1.8 },
  },
  {
    id: 'screener_walkout',
    name: 'Security screener walkout',
    blurb: 'Screeners are on a work-to-rule. Each passenger takes longer at the lanes.',
    fix: 'Open another lane so the queue does not reach the gates.',
    severity: 'warning',
    focus: 'security',
    minLevel: 3,
    baseOdds: 0.025,
    perLevel: 0.01,
    durationHours: [4, 10],
    effect: { kind: 'security', mult: 1.7 },
  },
  {
    id: 'atc_staffing',
    name: 'ATC staffing shortfall',
    blurb: 'The tower is short a controller. Departures are metered.',
    fix: 'Upcoming departures slip. Avoid stacking banks on one runway.',
    severity: 'warning',
    focus: 'runway',
    minLevel: 3,
    baseOdds: 0.02,
    perLevel: 0.012,
    durationHours: [2, 5],
    effect: { kind: 'delay', delaySec: 18 },
  },
  {
    id: 'suspicious_bag',
    name: 'Unattended bag',
    blurb: 'Police are clearing an unattended bag. Screening runs at half pace.',
    fix: 'More lanes absorb the slowdown. Police and guards keep it short.',
    severity: 'critical',
    focus: 'security',
    minLevel: 4,
    baseOdds: 0.02,
    perLevel: 0.01,
    durationHours: [1, 2],
    effect: { kind: 'security', mult: 2 },
  },
]

export interface ActiveOpsEvent {
  /** Unique per run, e.g. `bird_strike#3`. */
  id: string
  event: OpsEvent
  startedAt: number
  endsAt: number
  /** Stand keys (`c,r`) this event holds closed. */
  gateKeys: string[]
}

export interface OpsWorld {
  clock: number
  level: number
  /** Stand keys (`c,r`) that are free right now. Gate events close from these. Read only on start. */
  freeStands: () => string[]
}

/** Daily odds for one event at this airport level. 0 below its minLevel. */
export function opsDailyOdds(event: OpsEvent, level: number): number {
  if (!Number.isFinite(level) || level < event.minLevel) return 0
  const odds = event.baseOdds + event.perLevel * (level - event.minLevel)
  return Math.min(OPS_TUNING.maxDailyOdds, Math.max(0, odds))
}

export function opsEventsOn(clock: number): boolean {
  return Number.isFinite(clock) && Math.floor(clock / OPS_TUNING.daySec) >= OPS_TUNING.quietDays
}

/** One day's roll: maybe nothing, otherwise one event weighted by its odds. */
export function rollOpsEvent(
  level: number,
  rng: () => number,
  exclude: ReadonlySet<string> = new Set(),
): OpsEvent | null {
  const pool = OPS_EVENTS.filter((e) => !exclude.has(e.id)).map((e) => ({ e, p: opsDailyOdds(e, level) }))
  const live = pool.filter((x) => x.p > 0)
  const none = live.reduce((acc, x) => acc * (1 - x.p), 1)
  if (rng() >= 1 - none) return null
  const total = live.reduce((acc, x) => acc + x.p, 0)
  let roll = rng() * total
  for (const x of live) {
    if (roll < x.p) return x.e
    roll -= x.p
  }
  return live.at(-1)?.e ?? null
}

/** Holds live ops events. The sim reads the multipliers and closed gates each tick. */
export class OpsEventRunner {
  active: ActiveOpsEvent[] = []
  private rolledDay = -1
  private seq = 0
  private readonly rng: () => number

  constructor(rng: () => number = simRandom) {
    this.rng = rng
  }

  /** Expire finished events, then roll once per in-game day. Returns the event that started, if any. */
  tick(world: OpsWorld): ActiveOpsEvent | null {
    this.active = this.active.filter((a) => a.endsAt > world.clock)
    const day = Math.floor(world.clock / OPS_TUNING.daySec)
    if (!opsEventsOn(world.clock) || day === this.rolledDay) return null
    this.rolledDay = day
    const picked = rollOpsEvent(world.level, this.rng, new Set(this.active.map((a) => a.event.id)))
    return picked ? this.start(picked.id, world) : null
  }

  /** Start one event now. Tests and debug use this directly; it still honours the quiet days. */
  start(id: string, world: OpsWorld): ActiveOpsEvent | null {
    const event = OPS_EVENTS.find((e) => e.id === id)
    if (!event || !opsEventsOn(world.clock) || this.active.some((a) => a.event.id === id)) return null
    let gateKeys: string[] = []
    if (event.effect.kind === 'gate') {
      const held = this.closedGates()
      gateKeys = world.freeStands().filter((k) => !held.has(k)).slice(0, event.effect.gates ?? 1)
      if (!gateKeys.length) return null
    }
    const [lo, hi] = event.durationHours
    const hours = lo + (hi - lo) * this.rng()
    const run: ActiveOpsEvent = {
      id: `${event.id}#${++this.seq}`,
      event,
      startedAt: world.clock,
      endsAt: world.clock + hours * OPS_TUNING.hourSec,
      gateKeys,
    }
    this.active.push(run)
    return run
  }

  private mult(kind: 'checkin' | 'security'): number {
    let m = 1
    for (const a of this.active) if (a.event.effect.kind === kind) m *= a.event.effect.mult ?? 1
    return Number.isFinite(m) && m > 0 ? m : 1
  }

  checkInMultiplier(): number {
    return this.mult('checkin')
  }

  screeningMultiplier(): number {
    return this.mult('security')
  }

  closedGates(): Set<string> {
    return new Set(this.active.flatMap((a) => a.gateKeys))
  }

  reset(): void {
    this.active = []
    this.rolledDay = -1
  }
}

/** Alert-stack row text for one live event. One key per run so a refresh never duplicates. */
export function opsAlertText(run: ActiveOpsEvent): { key: string; severity: OpsEvent['severity']; title: string; detail: string } {
  return {
    key: `${OPS_ALERT_PREFIX}${run.id}`,
    severity: run.event.severity,
    title: run.event.name,
    detail: `${run.event.blurb} Fix: ${run.event.fix}`,
  }
}
