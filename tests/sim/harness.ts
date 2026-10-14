/**
 * Shared harness for the headless multi-day sim pack.
 *
 * Builds a seeded airport through the real `Game` API (starter kit: runway, stands, prefab
 * terminal, fuel farm, catering, bag belt, staff), runs N game days, and collects metrics.
 * Nothing here re-implements engine rules; it only drives and observes `Game`.
 * Setup mirrors scripts/soak-full.mts and src/game/sim.integration.test.ts.
 */
import { afterEach, beforeEach, expect } from 'vitest'
import { ALERT_TUNING, STUCK_PHASES } from '../../src/game/alertsData.ts'
import { Game } from '../../src/game/sim.ts'
import type { AirlineId, Difficulty } from '../../src/game/types.ts'

/** One game day is 180 sim seconds. */
export const DAY_SEC = 180
/** Sim seconds per tick. Coarser than the 60 fps frame so 30 days fit in the per-test budget. */
export const STEP_SEC = 3
/** Per-test wall-clock budget (ms). */
export const TEST_TIMEOUT_MS = 45_000

export interface SetupOptions {
  seed?: number
  difficulty?: Difficulty
  /** Bank after the starter kit is paid for. */
  cash?: number
  /** Airlines signed up front. Default: northline. */
  airlines?: AirlineId[]
  deskStaff?: number
  janitors?: number
  mechanics?: number
  /** Field level XP granted after land is bought. */
  fieldXp?: number
}

/** Coarser step for 30-day runs so they stay inside the per-test budget even on a busy CI box. */
export const LONG_STEP_SEC = 10

export interface RunOptions {
  /** Sim seconds per tick. Default STEP_SEC. */
  stepSec?: number
  /** Sign any contract offer that shows up, like a player would. Default true. */
  autoSign?: boolean
  /** Buy fuel loads when the farm runs low. Default true. */
  autoFuel?: boolean
  /** Called once per tick, after the sim step. */
  onTick?: (g: Game, day: number) => void
  /** Called at the start of each day (0-based), before any tick of that day. */
  onDayStart?: (g: Game, day: number) => void
}

export interface SimMetrics {
  days: number
  /** Cash at the close of each day (index 0 = end of day 1). */
  cashByDay: number[]
  startCash: number
  minCash: number
  paxServed: number
  flightsDone: number
  /** Most halls guests marked lost at any one moment. */
  lostPaxPeak: number
  bagsLost: number
  bagsMishandled: number
  /** Flight ids that sat in a taxi/pushback/hold phase past twice the alert threshold. */
  stuck: string[]
  /** Dotted paths of non-finite numbers found in the game, ledger, or flights. */
  nan: string[]
  ledgerEntries: number
}

/** Mulberry32 so a run does not depend on Math.random or test order. Returns the restore fn. */
export function seedRandom(seed: number): () => void {
  const orig = Math.random
  let s = seed >>> 0
  Math.random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  return () => {
    Math.random = orig
  }
}

/** Seeds Math.random for every test in the calling describe/file and restores it afterwards. */
export function useSeed(seed: number) {
  let restore: (() => void) | null = null
  beforeEach(() => {
    restore = seedRandom(seed)
  })
  afterEach(() => {
    restore?.()
    restore = null
  })
}

/** Seeded city airport from the starter kit, with the first carrier signed and staff hired. */
export function buildAirport(opts: SetupOptions = {}): Game {
  const g = new Game()
  g.sandbox = false
  g.beginNew(opts.difficulty ?? 'easy')
  g.startFocus = 'pax'
  if (!g.buyLand('city')) throw new Error('harness: buyLand failed')
  g.buildStarterKit()
  if (g.fits.length < 1) throw new Error('harness: starter kit did not stamp a terminal')
  if (opts.fieldXp) g.grantFieldXp(opts.fieldXp)
  g.cash = opts.cash ?? 150_000
  g.speed = 1
  for (const id of opts.airlines ?? ['northline']) {
    g.offer = { airline: id, age: 0, deadline: 36 }
    g.acceptOffer()
  }
  for (let i = 0; i < (opts.deskStaff ?? 0); i++) g.hireDeskStaff()
  if (opts.deskStaff) g.assignHallStaff()
  for (let i = 0; i < (opts.janitors ?? 0); i++) g.hireJanitor()
  for (let i = 0; i < (opts.mechanics ?? 0); i++) g.hireMechanic()
  return g
}

/** Ticks until every queued construction site has finished (or `maxSec` passes). */
export function settleBuilds(g: Game, maxSec = 600): boolean {
  for (let t = 0; t < maxSec && g.sites.length > 0; t += 1) g.tick(1)
  return g.sites.length === 0
}

/** Non-finite numbers on the game, its ledger, and live flights. */
export function findNaN(g: Game): string[] {
  const bad: string[] = []
  for (const [key, value] of Object.entries(g)) {
    if (typeof value === 'number' && !Number.isFinite(value)) bad.push(`game.${key}`)
  }
  const ledger = g.bank.ledger()
  for (const key of ['balance', 'totalIncome', 'totalExpense', 'net'] as const) {
    if (!Number.isFinite(ledger[key])) bad.push(`ledger.${key}`)
  }
  for (const entry of ledger.entries) {
    if (!Number.isFinite(entry.amount) || !Number.isFinite(entry.balanceAfter)) {
      bad.push(`ledger.entry#${entry.id}(${entry.category})`)
    }
  }
  for (const f of g.flights) {
    if (![f.x, f.y, f.z].every(Number.isFinite)) bad.push(`flight.${f.flightNo}.pose`)
  }
  return bad
}

function stuckFlights(g: Game, into: Set<string>) {
  const ground = STUCK_PHASES as readonly string[]
  for (const f of g.flights) {
    const onGround = ground.includes(f.phase) && f.phaseTime > ALERT_TUNING.stuckSec * 2
    const held = f.phase === 'hold' && f.phaseTime > ALERT_TUNING.holdStuckSec * 2
    if (onGround || held) into.add(f.id)
  }
}

/** Runs `days` game days from the current clock and returns the collected metrics. */
export function runDays(g: Game, days: number, opts: RunOptions = {}): SimMetrics {
  const autoSign = opts.autoSign ?? true
  const autoFuel = opts.autoFuel ?? true
  const stuck = new Set<string>()
  const nan = new Set<string>()
  const cashByDay: number[] = []
  const startCash = g.cash
  const startPax = g.paxServed
  const startFlights = g.flightsDone
  let minCash = g.cash
  let lostPaxPeak = 0
  const step = opts.stepSec ?? STEP_SEC
  const ticksPerDay = Math.round(DAY_SEC / step)

  for (let d = 0; d < days; d++) {
    opts.onDayStart?.(g, d)
    for (let i = 0; i < ticksPerDay; i++) {
      g.tick(step)
      if (autoSign && g.offer) g.acceptOffer()
      if (autoFuel && g.fuelBrand && g.fuelLoads < 2) g.buyLoads()
      opts.onTick?.(g, d)
      minCash = Math.min(minCash, g.cash)
      lostPaxPeak = Math.max(lostPaxPeak, g.lostPaxCount())
      if (i % 5 === 0) stuckFlights(g, stuck)
    }
    cashByDay.push(g.cash)
    for (const path of findNaN(g)) nan.add(path)
  }

  return {
    days,
    cashByDay,
    startCash,
    minCash,
    paxServed: g.paxServed - startPax,
    flightsDone: g.flightsDone - startFlights,
    lostPaxPeak,
    bagsLost: g.bagsLost,
    bagsMishandled: g.bagsMishandled,
    stuck: [...stuck],
    nan: [...nan],
    ledgerEntries: g.bank.ledger().entries.length,
  }
}

export interface HealthBounds {
  /** Lost passengers allowed at any one moment. Default 0. */
  maxLostPax?: number
  /** Lost checked bags allowed. Default 0. */
  maxLostBags?: number
  /** Vehicles / aircraft stuck past the alert threshold. Default 0. */
  maxStuck?: number
}

/** The checks every scenario shares: no NaN, no lost pax/bags, nothing stuck. */
export function expectHealthy(m: SimMetrics, bounds: HealthBounds = {}) {
  expect(m.nan, 'non-finite numbers').toEqual([])
  expect(m.lostPaxPeak, 'lost pax').toBeLessThanOrEqual(bounds.maxLostPax ?? 0)
  expect(m.bagsLost, 'lost bags').toBeLessThanOrEqual(bounds.maxLostBags ?? 0)
  expect(m.stuck.length, `stuck vehicles: ${m.stuck.join(', ')}`).toBeLessThanOrEqual(
    bounds.maxStuck ?? 0,
  )
}

/**
 * Cash may not more than triple between the close of `fromDay` and `toDay` (1-based).
 * The base is floored so a near-empty bank does not make any recovery look runaway.
 */
export function expectBoundedGrowth(m: SimMetrics, fromDay = 20, toDay = 30, floor = 25_000) {
  expect(m.cashByDay.length).toBeGreaterThanOrEqual(toDay)
  const from = m.cashByDay[fromDay - 1]
  const to = m.cashByDay[toDay - 1]
  expect(to).toBeLessThanOrEqual(3 * Math.max(from, floor))
}
