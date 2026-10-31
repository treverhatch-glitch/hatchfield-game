/**
 * Replays: a seeded game played by a fixed script, with a checkpoint at the end of every game day. The same
 * seed and script must give the same checkpoints every time, on every machine, and in the Unity port.
 *
 * A replay file (replays/<scenario>-<seed>.json) is the reference the Unity port is checked against: it plays
 * the same scenario from the same seed and must reach the same numbers, day by day.
 */
import { Game } from '../../src/game/sim.ts'

export const REPLAY_FORMAT = 'hatchfield-replay/1'
export const DAY_SEC = 180
export const STEP_SEC = 3

export interface Checkpoint {
  day: number
  cashCents: number
  revenueCents: number
  paxServed: number
  flightsDone: number
  reputationMilli: number
  bagsLost: number
  ledgerEntries: number
  liveFlights: number
  rngState: number
}

export interface ReplayFile {
  format: string
  scenario: string
  seed: number
  days: number
  stepSec: number
  rulesCommit: string | null
  checkpoints: Checkpoint[]
}

/** The scripted openings. Each is what a player does before the clock runs; the rest is the game's own. */
export const SCENARIOS: Record<string, { what: string; setup: (g: Game) => void; everyTick?: (g: Game) => void }> = {
  'city-start': {
    what: 'Easy city plot, the starter kit, Northline signed, one desk agent, one janitor, one mechanic; every contract offer accepted and fuel kept stocked',
    setup(g) {
      g.sandbox = false
      g.startFocus = 'pax'
      if (!g.buyLand('city')) throw new Error('replay: buyLand failed')
      g.buildStarterKit()
      g.cash = 250_000
      g.speed = 1
      g.offer = { airline: 'northline', age: 0, deadline: 36 }
      g.acceptOffer()
      g.hireDeskStaff()
      g.assignHallStaff()
      g.hireJanitor()
      g.hireMechanic()
    },
    everyTick(g) {
      if (g.offer) g.acceptOffer()
      if (g.fuelBrand && g.fuelLoads < 2) g.buyLoads()
    },
  },
}

export function checkpoint(g: Game, day: number): Checkpoint {
  return {
    day,
    cashCents: Math.round(g.cash * 100),
    revenueCents: Math.round(g.revenue * 100),
    paxServed: g.paxServed,
    flightsDone: g.flightsDone,
    reputationMilli: Math.round(g.reputation * 1000),
    bagsLost: g.bagsLost,
    ledgerEntries: g.bank.ledger().entries.length,
    liveFlights: g.flights.length,
    rngState: g.rng.state,
  }
}

/** Plays a scenario from a seed for `days` game days; a checkpoint after setup (day 0) and after each day. */
export function play(scenario: string, seed: number, days: number, stepSec = STEP_SEC): Checkpoint[] {
  const s = SCENARIOS[scenario]
  if (!s) throw new Error(`replay: no scenario "${scenario}" (${Object.keys(SCENARIOS).join(', ')})`)
  const g = new Game()
  g.beginNew('easy', seed)
  s.setup(g)
  const out = [checkpoint(g, 0)]
  const ticksPerDay = Math.round(DAY_SEC / stepSec)
  for (let d = 1; d <= days; d++) {
    for (let i = 0; i < ticksPerDay; i++) {
      g.tick(stepSec)
      s.everyTick?.(g)
    }
    out.push(checkpoint(g, d))
  }
  return out
}

/** The first difference between two checkpoint lists, in plain words, or null when they match. */
export function firstDifference(want: Checkpoint[], got: Checkpoint[]): string | null {
  for (let i = 0; i < Math.max(want.length, got.length); i++) {
    const a = want[i]
    const b = got[i]
    if (!a || !b) return `day ${i}: ${a ? 'missing in this run' : 'not in the replay file'}`
    for (const k of Object.keys(a) as (keyof Checkpoint)[]) {
      if (a[k] !== b[k]) return `day ${a.day}: ${k} was ${a[k]} in the replay file, ${b[k]} now`
    }
  }
  return null
}
